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
      console.log('stripeProducts', stripeProductsExists.data);
      if (existsProducts || stripeProductsExists.data.length > 0) {
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
    const price = await this.stripe.prices.create({
      unit_amount: data.unitAmout,
      currency: data.currency,
      recurring: { interval: data.interval },
      product: stripeProductId,
    });

    await this.prisma.prices.create({
      data: {
        product_id: productId,
        stripeProductId,
        unit_amout: data.unitAmout,
        currency: data.currency,
        priceId: price.id,
        recurring: data.interval,
      },
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
    if (!user) {
      throw new BadRequestException('Usuário não existe');
    }

    const customerExists = await this.stripe.customers.list({
      email: user.email,
    });

    if (customerExists.data.length > 0) {
      return customerExists.data[0].id;
    }
    const Customer = await this.stripe.customers.create({
      name: user.name,
      email: user.email,
      // payment_method: 'pm_card_visa',
      // invoice_settings: {
      //   default_payment_method: 'pm_card_visa',
      // },
    });

    console.log('test2', Customer.id);
    await this.prisma.user.update({
      where: {
        id: id,
      },
      data: {
        costumerId: Customer.id,
      },
    });
    return Customer.id;
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
    return {
      url: session.url,
    };
  }
}
