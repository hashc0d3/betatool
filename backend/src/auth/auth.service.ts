import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  private expectedLogin(): string {
    return process.env.ADMIN_LOGIN ?? 'playbetaadmin';
  }

  private expectedPassword(): string {
    return process.env.ADMIN_PASSWORD ?? 'playbetaadmin2026!';
  }

  async login(dto: LoginDto): Promise<string> {
    if (
      dto.login !== this.expectedLogin() ||
      dto.password !== this.expectedPassword()
    ) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }
    return this.jwtService.signAsync({ sub: dto.login });
  }
}
