import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthRole } from './auth.service';
import { ROLES_KEY } from './roles.decorator';

type AuthenticatedRequest = Request & {
  user?: {
    login: string;
    role: AuthRole;
  };
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<AuthRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (req.user?.role && roles.includes(req.user.role)) return true;

    throw new ForbiddenException('Недостаточно прав');
  }
}
