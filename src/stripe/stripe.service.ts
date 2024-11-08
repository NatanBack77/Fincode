import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { CreatePrice, createProducts } from './dtos/stripe.dto';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class StripeService {
  private stripe: Stripe;
  constructor(
    @Inject('STRIPE_API_KEY') private readonly apiKey: string,
    private readonly prisma: PrismaClient,
  ) {
    this.stripe = new Stripe(this.apiKey, {
      apiVersion: '2024-10-28.acacia',
    });
  }
  async createProduct(data: createProducts) {
    const prismaTransaction = await this.prisma.$transaction(async (prisma) => {
      const existsProducts = await prisma.products.findFirst({
        where: {
          name: data.name,
        },
      });
      const stripeProductsExists = await this.stripe.products.search({
        query: `name:"${data.name}"`,
      });
      if (existsProducts || stripeProductsExists) {
        throw new BadRequestException('Produto já existe');
      }

      const products = await prisma.products.create({
        data: {
          name: data.name,
          description: data.description,
        },
      });
      return products.id;
    });
    const stripeProduct = await this.stripe.products.create({
      name: data.name,
      description: data.description,
    });
    return {
      stripeProductId: stripeProduct.id,
      dbProductId: prismaTransaction,
    };
  }
  async CreatePrice(
    productId: string,
    stripeProductId: string,
    data: CreatePrice,
  ) {
    await this.prisma.prices.create({
      data: {
        product_id: productId,
        stripeProductId,
        unit_amout: data.unitAmout,
        currency: data.currency,
        recurring: data.interval,
      },
    });
    const price = await this.stripe.prices.create({
      unit_amount: data.unitAmout,
      currency: data.currency,
      recurring: { interval: data.interval },
      product: stripeProductId,
    });
    return price.id;
  }
  async createCostumers(id: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: id,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });
    const constumerExists = await this.stripe.customers.list({
      email: user.email,
    });

    if (constumerExists) {
      return constumerExists[0].id;
    }
    const customer = await this.stripe.customers.create({
      name: user.name,
      email: user.email,
      // payment_method: paymentMethod,
      // invoice_settings: { default_payment_method: paymentMethod },
    });

    await this.prisma.user.update({
      where: {
        id: id,
      },
      data: {
        costumerId: customer.id,
      },
    });
    return customer.id;
  }

  async createSubscription(id: string, priceId: string) {
    const customerId = await this.createCostumers(id);

    const subscription = await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      expand: ['latest_invoice.payment_intent'],
    });
    return subscription;
  }
  async createCheckoutSession(
    id: string,
    successUrl: string,
    cancelUrl: string,
    priceId: string,
  ) {
    const customerId = await this.createCostumers(id);
    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    return session;
  }
}
