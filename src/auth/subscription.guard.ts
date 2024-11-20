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
    const userId = request.user.sub;

    if (!userId) {
      throw new BadRequestException('Usuário não autenticado');
    }

    const userSubscriptions = await this.getUserSubscriptions(userId);
    if (!userSubscriptions.length) {
      throw new BadRequestException('Usuário sem permissão');
    }

    const allowedProducts = this.getAllowedProductsForRoute(context);
    const hasAccess = this.checkUserAccess(userSubscriptions, allowedProducts);

    if (!hasAccess) {
      throw new BadRequestException(
        'Usuário sem permissão para acessar este recurso',
      );
    }

    return hasAccess;
  }

  private async getUserSubscriptions(userId: string) {
    return this.prisma.subscriptions.findMany({
      where: {
        userId,
        hasActiveSubscription: true,
      },
      select: {
        Price: {
          select: {
            Products: {
              select: { name: true },
            },
          },
        },
      },
    });
  }

  private getAllowedProductsForRoute(context: ExecutionContext): string[] {
    const handler = context.getHandler();
    const allowedProducts = this.reflector.get<string[]>('products', handler);
    return allowedProducts || [];
  }

  private checkUserAccess(
    subscriptions: Array<{ Price: { Products: { name: string } } }>,
    allowedProducts: string[],
  ): boolean {
    return subscriptions.some((sub) =>
      allowedProducts.includes(sub.Price.Products.name),
    );
  }
}
