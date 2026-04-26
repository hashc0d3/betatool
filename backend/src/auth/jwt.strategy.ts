import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

function jwtSecret(): string {
  return (
    process.env.JWT_SECRET ??
    'club-inventory-jwt-secret-min-32-characters-long!'
  );
}

function extractors() {
  return [
    (req: Request) =>
      typeof req?.cookies?.access_token === 'string'
        ? req.cookies.access_token
        : null,
    ExtractJwt.fromAuthHeaderAsBearerToken(),
  ];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors(extractors()),
      ignoreExpiration: false,
      secretOrKey: jwtSecret(),
    });
  }

  validate(payload: { sub: string }) {
    return { login: payload.sub };
  }
}
