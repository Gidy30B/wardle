import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createPublicKey, verify as verifySignature } from 'crypto';
import { getEnv } from '../core/config/env.validation';

type JwtHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
};

type JwtPayload = {
  sub?: string;
  email?: string;
  email_address?: string;
  email_addresses?: Array<{ email_address?: string }>;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
};

type JwkEntry = {
  kid?: string;
  kty?: string;
  n?: string;
  e?: string;
  alg?: string;
  use?: string;
  [key: string]: unknown;
};

type VerifiedClerkPrincipal = {
  clerkId: string;
  email?: string | null;
  payload: JwtPayload;
};

@Injectable()
export class ClerkJwtService {
  private readonly jwksCache = new Map<string, JwkEntry>();
  private cachedJwksAt = 0;

  async verifyBearerToken(token: string): Promise<VerifiedClerkPrincipal> {
    const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
    if (!encodedHeader || !encodedPayload || !encodedSignature) {
      throw new UnauthorizedException('Invalid Clerk JWT');
    }

    const header = this.parseSegment<JwtHeader>(encodedHeader);
    const payload = this.parseSegment<JwtPayload>(encodedPayload);

    if (header.alg !== 'RS256' || !header.kid) {
      throw new UnauthorizedException('Unsupported Clerk JWT');
    }

    this.assertClaims(payload);

    const jwk = await this.getJwk(header.kid);
    const publicKey = createPublicKey({ key: jwk as any, format: 'jwk' });

    const signature = this.base64UrlToBuffer(encodedSignature);
    const signedContent = Buffer.from(`${encodedHeader}.${encodedPayload}`);
    const valid = verifySignature('RSA-SHA256', signedContent, publicKey, signature);

    if (!valid) {
      throw new UnauthorizedException('Invalid Clerk JWT signature');
    }

    const clerkId = payload.sub;
    if (!clerkId) {
      throw new UnauthorizedException('Missing Clerk subject');
    }

    return {
      clerkId,
      email: this.resolveEmail(payload),
      payload,
    };
  }

  private async getJwk(kid: string): Promise<JwkEntry> {
    const jwksUrl = this.getJwksUrl();

    const now = Date.now();
    const shouldRefresh = now - this.cachedJwksAt > 5 * 60 * 1000;
    if (shouldRefresh) {
      this.jwksCache.clear();
      this.cachedJwksAt = now;

      const response = await fetch(jwksUrl);
      if (!response.ok) {
        throw new UnauthorizedException('Unable to fetch Clerk JWKS');
      }

      const body = (await response.json()) as { keys?: JwkEntry[] };
      for (const key of body.keys ?? []) {
        if (key.kid) {
          this.jwksCache.set(key.kid, key);
        }
      }
    }

    const cached = this.jwksCache.get(kid);
    if (!cached) {
      throw new UnauthorizedException('Clerk signing key not found');
    }

    return cached;
  }

  private getJwksUrl(): string {
    const explicit = process.env.CLERK_JWKS_URL;
    if (explicit) {
      return explicit;
    }

    const issuer = this.getIssuer().replace(/\/+$/, '');
    return `${issuer}/.well-known/jwks.json`;
  }

  private getIssuer(): string {
    return getEnv().CLERK_JWT_ISSUER;
  }

  private parseSegment<T>(segment: string): T {
    const raw = Buffer.from(this.base64UrlToBase64(segment), 'base64').toString('utf8');
    return JSON.parse(raw) as T;
  }

  private base64UrlToBase64(value: string): string {
    return value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  }

  private base64UrlToBuffer(value: string): Buffer {
    return Buffer.from(this.base64UrlToBase64(value), 'base64');
  }

  private assertClaims(payload: JwtPayload): void {
    const env = getEnv();
    const expectedIssuer = this.getIssuer().replace(/\/+$/, '');
    const tokenIssuer = (payload.iss ?? '').replace(/\/+$/, '');

    if (tokenIssuer !== expectedIssuer) {
      console.warn('JWT issuer:', payload.iss ?? '(missing)');
      console.warn('Expected:', expectedIssuer);

      if (env.NODE_ENV === 'production') {
        throw new UnauthorizedException('Invalid Clerk issuer');
      }

      console.warn('[DEV AUTH WARNING] Issuer mismatch allowed in non-production mode.');
    }

    const audience = env.CLERK_JWT_AUDIENCE;
    const claimAudience = Array.isArray(payload.aud)
      ? payload.aud
      : [payload.aud].filter(Boolean);
    if (!claimAudience.includes(audience)) {
      throw new UnauthorizedException('Invalid Clerk audience');
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new UnauthorizedException('Clerk token expired');
    }

    if (payload.nbf && payload.nbf > now + 60) {
      throw new UnauthorizedException('Clerk token not yet valid');
    }
  }

  private resolveEmail(payload: JwtPayload): string | null {
    return (
      payload.email ??
      payload.email_address ??
      payload.email_addresses?.[0]?.email_address ??
      null
    );
  }
}
