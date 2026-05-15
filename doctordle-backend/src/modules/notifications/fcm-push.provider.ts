import { Injectable, Logger } from '@nestjs/common';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { getEnv } from '../../core/config/env.validation';

export type PushSendRequest = {
  tokens: string[];
  title: string;
  body: string;
  data: Record<string, string>;
};

export type PushSendResult = {
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
};

const FIREBASE_APP_NAME = 'wardle-push';

@Injectable()
export class FcmPushProvider {
  private readonly logger = new Logger(FcmPushProvider.name);
  private readonly messaging: Messaging | null;

  constructor() {
    this.messaging = this.initializeMessaging();
  }

  isConfigured(): boolean {
    return Boolean(this.messaging);
  }

  async sendMulticast(input: PushSendRequest): Promise<PushSendResult> {
    if (input.tokens.length === 0) {
      return {
        successCount: 0,
        failureCount: 0,
        invalidTokens: [],
      };
    }

    if (!this.messaging) {
      this.logger.log(
        JSON.stringify({
          event: 'push.fcm.noop',
          reason: 'disabled_or_misconfigured',
          tokenCount: input.tokens.length,
        }),
      );
      return {
        successCount: 0,
        failureCount: 0,
        invalidTokens: [],
      };
    }

    const response = await this.messaging.sendEachForMulticast({
      tokens: input.tokens,
      notification: {
        title: input.title,
        body: input.body,
      },
      data: input.data,
    });

    const invalidTokens = response.responses.flatMap((sendResponse, index) => {
      if (sendResponse.success) {
        return [];
      }

      const code = sendResponse.error?.code;
      return code && this.isInvalidTokenCode(code) ? [input.tokens[index]] : [];
    });

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokens,
    };
  }

  private initializeMessaging(): Messaging | null {
    const env = getEnv();

    if (!env.PUSH_NOTIFICATIONS_ENABLED) {
      this.logger.log(
        JSON.stringify({
          event: 'push.fcm.noop',
          reason: 'disabled',
        }),
      );
      return null;
    }

    if (
      !env.FIREBASE_PROJECT_ID ||
      !env.FIREBASE_CLIENT_EMAIL ||
      !env.FIREBASE_PRIVATE_KEY
    ) {
      this.logger.warn(
        JSON.stringify({
          event: 'push.fcm.noop',
          reason: 'missing_firebase_env',
        }),
      );
      return null;
    }

    try {
      const app = this.getOrCreateFirebaseApp({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      });

      this.logger.log(
        JSON.stringify({
          event: 'push.fcm.initialized',
          projectId: env.FIREBASE_PROJECT_ID,
        }),
      );

      return getMessaging(app);
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'push.fcm.noop',
          reason: 'initialization_failed',
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      return null;
    }
  }

  private getOrCreateFirebaseApp(input: {
    projectId: string;
    clientEmail: string;
    privateKey: string;
  }): App {
    const existing = getApps().find((app) => app.name === FIREBASE_APP_NAME);
    if (existing) {
      return existing;
    }

    return initializeApp(
      {
        credential: cert({
          projectId: input.projectId,
          clientEmail: input.clientEmail,
          privateKey: input.privateKey,
        }),
      },
      FIREBASE_APP_NAME,
    );
  }

  private isInvalidTokenCode(code: string): boolean {
    return (
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-registration-token'
    );
  }
}
