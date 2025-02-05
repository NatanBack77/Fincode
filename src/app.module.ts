import { Module, OnModuleInit } from '@nestjs/common';
import * as redisStore from 'cache-manager-redis-store';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { RedisController } from './redis/redis.controller';
import { RedisModule } from './redis/redis.module';
import { seconds, ThrottlerModule } from '@nestjs/throttler';
import { StripeController } from './stripe/stripe.controller';
import { StripeModule } from './stripe/stripe.module';
import { PrismaService } from './prisma/prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.register({
      isGlobal: true,
      store: redisStore,
      url: process.env.REDISCLOUD_URL || process.env.REDIS_URL,
    }),

    ThrottlerModule.forRoot({
      throttlers: [{ limit: 5, ttl: seconds(60) }],
      storage: new ThrottlerStorageRedisService(
        process.env.REDISCLOUD_URL || process.env.REDIS_URL,
      ),
    }),
    AuthModule,
    PrismaModule,
    UserModule,
    RedisModule,
    StripeModule.forRootAsync(),
  ],
  controllers: [AppController, RedisController, StripeController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
