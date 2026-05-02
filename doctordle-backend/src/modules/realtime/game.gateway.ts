import {
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import {
  ConnectedSocket,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { ClerkJwtService } from '../../auth/clerk-jwt.service';
import { PrismaService } from '../../core/db/prisma.service';
import { RedisPubSubService } from '../../core/redis/redis-pubsub.service';
import {
  NOTIFICATION_V1_CREATED_EVENT,
  type NotificationCreatedRealtimePayload,
} from '../notifications/notification.types';

type RewardAppliedPayload = {
  xp: number;
  streak?: number;
  correlationId?: string;
};

type ExplanationReadyPayload = {
  caseId: string;
  content: string;
};

const GAME_V1_REWARD_APPLIED_EVENT = 'game.v1.reward.applied';
const GAME_V1_EXPLANATION_READY_EVENT = 'game.v1.explanation.ready';

type RealtimeEnvelope =
  | {
      type: typeof GAME_V1_REWARD_APPLIED_EVENT;
      userId: string;
      payload: RewardAppliedPayload;
    }
  | {
      type: typeof GAME_V1_EXPLANATION_READY_EVENT;
      userId: string;
      payload: ExplanationReadyPayload;
    }
  | {
      type: typeof NOTIFICATION_V1_CREATED_EVENT;
      userId: string;
      payload: NotificationCreatedRealtimePayload;
    };

@WebSocketGateway({ cors: { origin: '*' } })
export class GameGateway implements OnModuleInit {
  @WebSocketServer()
  server?: Server;

  private readonly logger = new Logger(GameGateway.name);
  private readonly channelName = 'ws:events';

  constructor(
    private readonly clerkJwtService: ClerkJwtService,
    private readonly prisma: PrismaService,
    private readonly redisPubSub: RedisPubSubService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.redisPubSub.subscribe(this.channelName, (event: RealtimeEnvelope) => {
      this.logger.log({
        event: 'ws.redis.received',
        type: event.type,
        userId: event.userId,
      });

      if (!this.server) {
        return;
      }

      this.logger.log({
        event: 'ws.emit',
        type: event.type,
        userId: event.userId,
      });

      this.server.to(event.userId).emit(event.type, event.payload);
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    this.logger.log({
      event: 'ws.connection.attempt',
      socketId: client.id,
    });

    const token = this.extractHandshakeToken(client);

    if (!token) {
      if (process.env.NODE_ENV === 'development') {
        this.logger.warn('WS DEV MODE: skipping auth');
        return;
      }

      this.logger.warn({
        event: 'ws.connection.failed',
        reason: 'missing_token',
        socketId: client.id,
      });
      client.disconnect();
      return;
    }

    try {
      const principal = await this.clerkJwtService.verifyBearerToken(token);
      const clerkId = principal.clerkId;
      const userId = await this.resolveUserIdFromClerk(clerkId);

      if (!userId) {
        this.logger.error({
          event: 'ws.auth.user_not_found',
          clerkId,
          socketId: client.id,
        });
        client.disconnect();
        return;
      }

      client.data.userId = userId;
      client.join(userId);

      this.logger.log({
        event: 'ws.connection.authenticated',
        clerkId,
        userId,
        socketId: client.id,
      });
    } catch (error) {
      this.logger.warn({
        event: 'ws.connection.failed',
        reason: 'invalid_token',
        socketId: client.id,
        error: error instanceof Error ? error.message : String(error),
      });
      client.disconnect();
    }
  }

  @SubscribeMessage('join')
  handleJoin(@ConnectedSocket() _client: Socket): void {
    // Room assignment now happens during authenticated connection setup.
  }

  async emitRewardApplied(
    userId: string,
    payload: RewardAppliedPayload,
  ): Promise<void> {
    this.emitRewardAppliedLocally(userId, payload);
  }

  async emitExplanationReady(
    userId: string,
    payload: ExplanationReadyPayload,
  ): Promise<void> {
    this.emitExplanationReadyLocally(userId, payload);
  }

  private extractHandshakeToken(client: Socket): string | null {
    const token = client.handshake.auth?.token;

    if (typeof token !== 'string') {
      return null;
    }

    const normalizedToken = token.trim();
    return normalizedToken.length > 0 ? normalizedToken : null;
  }

  private async resolveUserIdFromClerk(clerkId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    return user?.id ?? null;
  }

  private emitRewardAppliedLocally(
    userId: string,
    payload: RewardAppliedPayload,
  ): void {
    if (!this.server) {
      return;
    }

    this.logger.log({
      event: 'ws.emit.reward_applied',
      userId,
      correlationId: payload?.correlationId,
      xp: payload.xp,
    });

    this.server.to(userId).emit(GAME_V1_REWARD_APPLIED_EVENT, payload);
  }

  private emitExplanationReadyLocally(
    userId: string,
    payload: ExplanationReadyPayload,
  ): void {
    if (!this.server) {
      return;
    }

    this.logger.log({
      event: 'ws.emit.explanation_ready',
      userId,
      caseId: payload.caseId,
    });

    this.server.to(userId).emit(GAME_V1_EXPLANATION_READY_EVENT, payload);
  }
}
