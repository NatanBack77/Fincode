import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { RedisController } from './redis/redis.controller';
import { RedisModule } from './redis/redis.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { StripeController } from './stripe/stripe.controller';
import { StripeModule } from './stripe/stripe.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60, limit: 10 }]),
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    PrismaModule,
    UserModule,
    RedisModule,
    StripeModule.forRootAsync(),
  ],
  controllers: [AppController, RedisController, StripeController],
  providers: [AppService],
})
export class AppModule {}
