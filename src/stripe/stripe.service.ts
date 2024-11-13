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
    const existSubscriptions = await this.prisma.subscriptions.findFirst({
      where: {
        userId: id,
      },
    });
    if (existSubscriptions) {
      return existSubscriptions.subscriptionId;
    }
    const subscription = await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      expand: ['latest_invoice.payment_intent'],
    });
    const Price = await this.prisma.prices.findFirst({
      where: {
        priceId: priceId,
      },
    });
    await this.prisma.subscriptions.create({
      data: {
        subscriptionId: subscription.id,
        pricesId: Price.id,
        userId: id,
        hasActiveSubscription: false,
      },
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
    const existSubscriptions = await this.prisma.subscriptions.findFirst({
      where: {
        userId: id,
      },
    });
    if (!existSubscriptions) {
      await this.createSubscription(id, priceId);
    }

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
  constructWebhookEvent(
    body: Buffer,
    sig: string,
    secret: string,
  ): Stripe.Event {
    return this.stripe.webhooks.constructEvent(body, sig, secret);
  }
  async handleWebhook(event: Stripe.Event) {
    switch (event.type) {
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        console.log('customerId', customerId);

        const user = await this.prisma.user.findFirst({
          where: {
            costumerId: customerId,
          },
        });
        console.log(user.id);
        if (!user) {
          throw new BadRequestException(
            `Usuário com costumerId ${customerId} não encontrado`,
          );
        }
        const subscription = await this.prisma.subscriptions.update({
          where: {
            userId: user.id,
          },
          data: {
            hasActiveSubscription: true,
          },
        });
        console.log('subscription', subscription);

        console.log(`Pagamento confirmado para o cliente ${customerId}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const user = await this.prisma.user.findFirst({
          where: {
            costumerId: customerId,
          },
        });
        await this.prisma.subscriptions.update({
          where: {
            userId: user.id,
          },
          data: {
            hasActiveSubscription: false,
          },
        });

        console.log(`Pagamento falhou para o cliente ${customerId}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const user = await this.prisma.user.findFirst({
          where: {
            costumerId: customerId,
          },
        });
        await this.prisma.subscriptions.update({
          where: {
            userId: user.id,
          },
          data: {
            hasActiveSubscription: false,
          },
        });

        console.log(`Assinatura cancelada para o cliente ${customerId}`);
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const newPriceId = subscription.items.data[0]?.price.id;

        const user = await this.prisma.user.findFirst({
          where: {
            costumerId: customerId,
          },
        });
        const existSubscriptions = await this.prisma.subscriptions.findFirst({
          where: {
            userId: user.id,
          },
        });
        if (existSubscriptions) {
          await this.prisma.subscriptions.update({
            where: {
              userId: user.id,
            },
            data: {
              hasActiveSubscription: subscription.status === 'active',
              pricesId: newPriceId,
            },
          });
          console.log(
            `Assinatura ${subscription.id} atualizada com novo plano.`,
          );
        } else {
          await this.prisma.subscriptions.create({
            data: {
              subscriptionId: subscription.id,
              userId: user.id,
              pricesId: newPriceId,
              hasActiveSubscription: subscription.status === 'active',
            },
          });
        }

        break;
      }

      default:
        console.log(`Evento não tratado: ${event.type}`);
    }
  }
}
