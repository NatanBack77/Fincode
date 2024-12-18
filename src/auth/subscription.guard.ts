import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { SUBSCRIPTION_PRODUCTS_KEY } from './roles.decorator';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request?.user?.sub;

    if (!userId) {
      throw new BadRequestException('Usuário não autenticado.');
    }

    const requiredProducts = this.reflector.get<string[]>(
      SUBSCRIPTION_PRODUCTS_KEY,
      context.getHandler(),
    );

    if (!requiredProducts || requiredProducts.length === 0) {
      throw new ForbiddenException('Nenhum produto associado a este recurso.');
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

    if (!user) {
      throw new BadRequestException('Usuário não encontrado.');
    }

    const hasAccess = user.Subscriptions.some((sub) => {
      const isProductValid =
        sub.Price.Products &&
        requiredProducts.includes(sub.Price.Products.name);
      const isSubscriptionValid =
        sub.subscriptionEnd === null || new Date() <= sub.subscriptionEnd;

      return isProductValid && isSubscriptionValid;
    });

    if (!hasAccess) {
      throw new BadRequestException('Usuário não possui acesso a esse recurso');
    }

    return true;
  }
}
