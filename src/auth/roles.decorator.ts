import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const SUBSCRIPTION_PRODUCTS_KEY = 'products';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
export const SubscriptionProducts = (...products: string[]) =>
  SetMetadata(SUBSCRIPTION_PRODUCTS_KEY, products);
