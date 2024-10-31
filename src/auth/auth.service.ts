import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtConstants } from './constants';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async logout(token: string): Promise<void> {
    const decoded: any = this.jwtService.decode(token);

    if (!decoded) {
      throw new Error('Token inválido');
    }

    const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);

    await this.redisService.set(token, 'blacklisted', expiresIn);
  }

  async isBlacklisted(token: string): Promise<boolean> {
    const result = await this.redisService.get(token);
    return !!result;
  }
  async generateToken(payload: { sub: string }): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: JwtConstants.secret,
    });
  }
}
