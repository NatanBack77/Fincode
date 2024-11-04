import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtConstants } from './constants';
import { RedisService } from 'src/redis/redis.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { addMinutes } from 'date-fns';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
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
  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const existsReset = await this.redisService.get(email);
    if (existsReset) {
      throw new BadRequestException('Usuário já solicitou o reset');
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(resetToken, 10);

    const expires = addMinutes(new Date(), 15);
    await this.prisma.user.update({
      where: { email: email },
      data: {
        resetPasswordToken: tokenHash,
        resetPasswordExpires: expires,
      },
    });
    const expiresIn =
      Math.floor(expires.getTime() / 1000) - Math.floor(Date.now() / 1000);

    await this.redisService.set(email, 'blacklisted', expiresIn);

    return {
      message: `Instruções de reset de senha enviadas ${user.email}para o e-mail`,
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        resetPasswordExpires: { gt: new Date() },
      },
    });

    if (!user || !(await bcrypt.compare(token, user.resetPasswordToken))) {
      throw new BadRequestException('Token inválido ou expirado');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    return { message: 'Senha alterada com sucesso' };
  }
}
