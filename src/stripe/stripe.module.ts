import { DynamicModule, forwardRef, Module } from '@nestjs/common';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { StripeController } from './stripe.controller';
import { StripeService } from './stripe.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RedisModule } from 'src/redis/redis.module';
import { UserModule } from 'src/user/user.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthService } from 'src/auth/auth.service';
@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class StripeModule {
  static forRootAsync(): DynamicModule {
    return {
      module: StripeModule,
      imports: [
        ConfigModule.forRoot(),
        PrismaModule,
        forwardRef(() => RedisModule),
        forwardRef(() => UserModule),
      ],
      controllers: [StripeController],
      providers: [
        PrismaService,
        AuthService,
        StripeService,
        {
          provide: 'STRIPE_API_KEY',
          useFactory: async (configService: ConfigService) =>
            configService.get<string>('STRIPE_API_KEY'),
          inject: [ConfigService],
        },
      ],
      exports: [StripeService],
    };
  }
}
