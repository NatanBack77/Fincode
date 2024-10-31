import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthService } from 'src/auth/auth.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RedisService } from 'src/redis/redis.service';

@Module({
  imports: [PrismaModule],
  providers: [UserService, PrismaService, AuthService, RedisService],
  exports: [UserService],
  controllers: [UserController],
})
export class UserModule {}
