import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    if (!userId) {
      return false;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        Subscriptions: {
          include: {
            Price: {
              include: {
                Products: true,
              },
            },
          },
        },
      },
    });

    if (!user || user.Subscriptions.length === 0) {
      throw new BadRequestException('Usuário sem permissão');
    }

    const allowedProducts = this.getAllowedProductsForRoute(context);
    const hasAccess = user.Subscriptions.some(
      (sub) =>
        sub.hasActiveSubscription === true &&
        allowedProducts.includes(sub.Price.Products.name),
    );

    return hasAccess;
  }

  private getAllowedProductsForRoute(context: ExecutionContext): string[] {
    const handler = context.getHandler();
    const allowedProducts = this.reflector.get<string[]>('products', handler);
    return allowedProducts || [];
  }
}
