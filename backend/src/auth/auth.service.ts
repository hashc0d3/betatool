import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';

export type AuthRole = 'admin' | 'deleted-sales-admin';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  private expectedLogin(): string {
    return process.env.ADMIN_LOGIN ?? 'playbetaadmin';
  }

  private expectedPassword(): string {
    return process.env.ADMIN_PASSWORD ?? 'playbetaadmin2026!';
  }

  private deletedSalesLogin(): string {
    return process.env.DELETED_SALES_LOGIN ?? 'admin2026';
  }

  private deletedSalesPassword(): string {
    return process.env.DELETED_SALES_PASSWORD ?? 'admin2026!';
  }

  async login(dto: LoginDto): Promise<string> {
    const role = this.roleForCredentials(dto);
    if (!role) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }
    return this.jwtService.signAsync({ sub: dto.login, role });
  }

  private roleForCredentials(dto: LoginDto): AuthRole | null {
    if (
      dto.login === this.deletedSalesLogin() &&
      dto.password === this.deletedSalesPassword()
    ) {
      return 'deleted-sales-admin';
    }
    if (
      dto.login === this.expectedLogin() &&
      dto.password === this.expectedPassword()
    ) {
      return 'admin';
    }
    return null;
  }
}
