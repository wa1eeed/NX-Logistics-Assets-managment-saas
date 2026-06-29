import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AccessService } from './access.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  /** Which identity table to resolve from: tenant User vs Control-Plane PlatformAdmin. */
  kind: 'tenant' | 'platform';
  type: 'access';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly accessService: AccessService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET') ?? 'change-me',
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }
    // Re-resolve roles/permissions/scope from DB on every request.
    return payload.kind === 'platform'
      ? this.accessService.buildPlatformPrincipal(payload.sub)
      : this.accessService.buildPrincipal(payload.sub);
  }
}
