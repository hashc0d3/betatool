import { Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NextFunction, Request, Response } from 'express';

function jwtSecret(): string {
  return (
    process.env.JWT_SECRET ??
    'club-inventory-jwt-secret-min-32-characters-long!'
  );
}

/** Статика /uploads обходит глобальный guard — проверяем JWT здесь. */
@Injectable()
export class UploadsAuthMiddleware implements NestMiddleware {
  constructor(private readonly jwtService: JwtService) {}

  use(req: Request, res: Response, next: NextFunction) {
    if (!req.path.startsWith('/uploads')) {
      return next();
    }
    const token = req.cookies?.access_token;
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
      this.jwtService.verify(token, { secret: jwtSecret() });
      return next();
    } catch {
      return res.status(401).json({ message: 'Unauthorized' });
    }
  }
}
