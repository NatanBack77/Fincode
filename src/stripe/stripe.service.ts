import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import Stripe from 'stripe';
import { CreatePrice, createProducts } from './dtos/stripe.dto';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);

  constructor(
    @Inject('STRIPE_API_KEY') private readonly apiKey: string,
    private readonly prisma: PrismaClient,
  ) {
    this.stripe = new Stripe(this.apiKey, {
      apiVersion: '2024-10-28.acacia',
    });
  }

  async getAllProduct() {
    return this.prisma.products.findMany({
      include: { Prices: true },
    });
  }

  async getUserSubscription(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { Subscriptions: true },
    });
    if (!user) {
      throw new BadRequestException('Usuário não encontrado');
    }
    if (user.Subscriptions && user.Subscriptions.length > 0) {
      return user.Subscriptions[0];
    }
    throw new BadRequestException('Usuário não tem uma assinatura ativa');
  }
  async crateTokenPayment(cardDetails: {
    number: string;
    exp_month: number;
    exp_year: number;
    cvc: string;
  }) {
    const token = await this.stripe.tokens.create({
      card: {
        number: cardDetails.number,
        exp_month: cardDetails.exp_month.toString(),
        exp_year: cardDetails.exp_year.toString(),
        cvc: cardDetails.cvc,
      },
    });
    return token;
  }
  async createPaymentMethod(cardDetails: {
    number: string;
    exp_month: number;
    exp_year: number;
    cvc: string;
  }) {
    try {
      const paymentMethod = await this.stripe.paymentMethods.create({
        type: 'card',
        card: cardDetails,
      });
      return paymentMethod.id;
    } catch (error) {
      this.logger.error('Erro ao criar método de pagamento', error);
      throw new BadRequestException(
        'Falha ao criar método de pagamento',
        error,
      );
    }
  }

  async addPaymentMethodToCustomer(
    customerId: string,
    paymentMethodId: string,
  ) {
    try {
      await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
      await this.stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
    } catch (error) {
      this.logger.error(
        'Erro ao associar método de pagamento ao cliente',
        error,
      );
      throw new BadRequestException('Falha ao adicionar método de pagamento');
    }
  }

  async createProduct(data: createProducts) {
    const existingProduct = await this.prisma.products.findFirst({
      where: { name: data.name },
    });

    if (existingProduct) {
      throw new BadRequestException('Produto já existe no banco de dados');
    }

    const stripeProducts = await this.stripe.products.search({
      query: `name:"${data.name}"`,
    });

    if (stripeProducts.data.length > 0) {
      throw new BadRequestException('Produto já existe na Stripe');
    }

    const newProduct = await this.prisma.products.create({
      data: {
        name: data.name,
        description: data.description,
      },
    });

    const stripeProduct = await this.stripe.products.create({
      name: data.name,
      description: data.description,
    });

    return {
      dbProductId: newProduct.id,
      stripeProductId: stripeProduct.id,
    };
  }

  async createPrice(
    data: CreatePrice,
    productId: string,
    stripeProductId: string,
  ) {
    const unitAmountCents = data.unitAmout * 100;

    const stripePrice = await this.stripe.prices.create({
      unit_amount: unitAmountCents,
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
        priceId: stripePrice.id,
        recurring: data.interval,
      },
    });

    return stripePrice.id;
  }

  async createCustomer(userId: string, payment_method: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    const existingCustomer = await this.stripe.customers.list({
      email: user.email,
    });
    const paymentMethod =
      await this.stripe.paymentMethods.retrieve(payment_method);
    if (!paymentMethod) {
      throw new BadRequestException('Método de Pagamento não encontrado');
    }

    if (existingCustomer.data.length > 0) {
      console.log('entrou', existingCustomer.data[0].id);
      return existingCustomer.data[0].id;
    }
    try {
      console.log('Dados enviados para Stripe:', {
        name: user.name,
        email: user.email,
      });
      const customer = await this.stripe.customers.create({
        payment_method: payment_method,
        email: user.email,
        invoice_settings: { default_payment_method: payment_method },
      });

      return customer.id;
    } catch (error) {
      throw new Error(`Stripe error: ${error.message}`);
    }
  }

  async createSubscription(
    userId: string,
    payment_method: string,
    productId: string,
  ) {
    const customerId = await this.createCustomer(userId, payment_method);

    const existingSubscription = await this.prisma.subscriptions.findFirst({
      where: { userId },
    });

    const pricesId = await this.prisma.prices.findFirst({
      where: { product_id: productId },
    });
    if (!pricesId) {
      throw new BadRequestException('Produto não existe');
    }

    if (existingSubscription) {
      const existingSubscriptionInStripe =
        await this.stripe.subscriptions.retrieve(
          existingSubscription.subscriptionId,
        );
      if (existingSubscriptionInStripe) {
        const subscription = await this.updateSubscription(
          userId,
          productId,
          payment_method,
        );
        return subscription;
      }
    }
    await this.addPaymentMethodToCustomer(customerId, payment_method);

    const subscription = await this.stripe.subscriptions.create({
      customer: customerId,
      cancel_at_period_end: false,
      items: [{ price: pricesId.priceId }],
      expand: ['latest_invoice.payment_intent'],
    });

    console.log('subscription', subscription);
    const price = await this.prisma.prices.findFirst({
      where: { product_id: productId },
    });

    await this.prisma.subscriptions.create({
      data: {
        subscriptionId: subscription.id,
        userId,
        pricesId: price.id,
        hasActiveSubscription: true,
      },
    });

    console.log('subscription', subscription);
    return subscription.id;
  }

  async updateSubscription(
    userId: string,
    productId: string,
    payment_method: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { Subscriptions: true },
    });

    if (!user) {
      throw new BadRequestException('Usuário não encontrado');
    }
    const pricesId = await this.prisma.prices.findFirst({
      where: { product_id: productId },
    });

    if (!pricesId) {
      throw new BadRequestException('Produto não existe');
    }

    const subscriptionId = user.Subscriptions[0].subscriptionId;
    const subscription =
      await this.stripe.subscriptions.retrieve(subscriptionId);
    const subscriptionItemId = subscription.items.data[0]?.id;

    if (user.Subscriptions && user.Subscriptions.length > 0) {
      const subscriptionId = user.Subscriptions[0].subscriptionId;
      const subscription = await this.stripe.subscriptions.update(
        subscriptionId,
        {
          cancel_at_period_end: false,
          items: [
            {
              id: subscriptionItemId,
              price: pricesId.priceId,
            },
          ],
        },
      );

      return subscription;
    }
    await this.createSubscription(userId, payment_method, productId);
  }

  async deleteSubscription(userId: string) {
    const subscription = await this.prisma.subscriptions.findFirst({
      where: {
        userId,
      },
    });
    await this.stripe.subscriptions.cancel(subscription.subscriptionId);
  }
  async createCheckoutSession(
    userId: string,
    successUrl: string,
    cancelUrl: string,
    priceId = 'price_1QK2hx06nRmRVtvs7wEIU6UV',
    token: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { costumerId: true, email: true, name: true },
    });

    if (!user) {
      throw new BadRequestException('Usuário não encontrado.');
    }

    let customerId = user.costumerId;
    if (!customerId) {
      this.logger.log('Cliente não encontrado no Stripe, criando um novo.');
      customerId = await this.createCustomer(userId, token);
    }

    const subscription = await this.createSubscription(userId, priceId, token);

    try {
      const session = await this.stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
      });

      this.logger.log(`Sessão de checkout criada: ${session.id}`);
      return {
        sessionId: session.id,
        url: session.url,
        subscriptionId: subscription,
      };
    } catch (error) {
      this.logger.error('Erro ao criar sessão de checkout.', error);
      throw new BadRequestException('Falha ao criar sessão de checkout.');
    }
  }

  constructWebhookEvent(
    body: Buffer,
    sig: string,
    secret: string,
  ): Stripe.Event {
    try {
      return this.stripe.webhooks.constructEvent(body, sig, secret);
    } catch (error) {
      this.logger.error('Erro ao validar evento do webhook', error);
      throw new BadRequestException('Evento inválido');
    }
  }

  async handleWebhook(event: Stripe.Event) {
    this.logger.log(`Evento recebido: ${event.type}`);

    switch (event.type) {
      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'customer.created':
        await this.handleCustomerCreated(event.data.object as Stripe.Customer);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;

      default:
        this.logger.warn(`Evento não tratado: ${event.type}`);
    }
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;

    const user = await this.prisma.user.findFirst({
      where: { costumerId: customerId },
    });

    if (!user) {
      this.logger.warn(`Usuário não encontrado para o cliente ${customerId}`);
      return;
    }

    await this.prisma.subscriptions.updateMany({
      where: { userId: user.id },
      data: { hasActiveSubscription: true },
    });

    this.logger.log(`Pagamento confirmado para o cliente ${customerId}`);
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;

    const user = await this.prisma.user.findFirst({
      where: { costumerId: customerId },
    });

    if (user) {
      await this.prisma.subscriptions.updateMany({
        where: { userId: user.id },
        data: { hasActiveSubscription: false },
      });
      this.logger.warn(`Pagamento falhou para o cliente ${customerId}`);
    }
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;

    const user = await this.prisma.user.findFirst({
      where: { costumerId: customerId },
    });

    if (user) {
      await this.prisma.subscriptions.delete({
        where: { userId: user.id },
      });
      this.logger.warn(`Assinatura cancelada para o cliente ${customerId}`);
    }
  }

  private async handleCustomerCreated(customer: Stripe.Customer) {
    const customerId = customer.id;
    const email = customer.email;

    const user = await this.prisma.user.findFirst({
      where: {
        email: email,
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { costumerId: customerId },
    });
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;
    const PriceId = subscription.items.data[0]?.price.id;

    const user = await this.prisma.user.findFirst({
      where: { costumerId: customerId },
    });
    const newPriceId = await this.prisma.prices.findFirst({
      where: {
        priceId: PriceId,
      },
    });

    if (!user) {
      this.logger.warn(`Usuário não encontrado para o cliente ${customerId}`);
      return;
    }

    const subscriptionRecord = await this.prisma.subscriptions.findFirst({
      where: { userId: user.id },
    });

    if (subscriptionRecord) {
      await this.prisma.subscriptions.update({
        where: { id: subscriptionRecord.id },
        data: { pricesId: newPriceId.id },
      });
      this.logger.log(`Assinatura atualizada para o cliente ${customerId}`);
    }
  }
}
