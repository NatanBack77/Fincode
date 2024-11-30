import {
  BadRequestException,
  ConsoleLogger,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import Stripe from 'stripe';
import { CreatePrice, createProducts } from './dtos/stripe.dto';
import { PrismaClient, SubscriptionStatus } from '@prisma/client';

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

  async getCustomerByUserId(userId: string) {
    return await this.prisma.user.findFirst({
      where: {
        id: userId,
      },
      select: {
        costumerId: true,
      },
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
    console.log('token', token);
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
  async hasActiveSubscriptionWithSamePlan(customerId: string, priceId: string) {
    try {
      const subscriptions = await this.stripe.subscriptions.list({
        customer: customerId,
        status: 'active',
        limit: 100,
      });

      const hasActivePlan = subscriptions.data.some((subscription) => {
        return subscription.items.data.some(
          (item) => item.price.id === priceId,
        );
      });

      return hasActivePlan;
    } catch (error) {
      this.logger.error(
        'Erro ao verificar assinatura ativa com o mesmo plano',
        error,
      );
      throw new BadRequestException(
        'Erro ao verificar assinatura ativa com o mesmo plano',
      );
    }
  }

  async addPaymentMethodToCustomer(
    customerId: string,
    paymentMethodId: string,
  ) {
    try {
      const paymentMethod =
        await this.stripe.paymentMethods.retrieve(paymentMethodId);
      if (!paymentMethod) {
        throw new BadRequestException('Método de Pagamento não encontrado');
      }
      const validateExistsUserWithPaymentMethod =
        await this.stripe.paymentMethods.list({
          customer: customerId,
          type: 'card',
        });

      const isAlreadyAttached = validateExistsUserWithPaymentMethod.data.some(
        (pm) => {
          pm.id === paymentMethodId;
        },
      );
      if (isAlreadyAttached) {
        throw new BadRequestException(
          'Método de Pagamento já associado ao usuário',
        );
      }
      const test = await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });

      await this.stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: test.id },
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
        email: user.email,
      });

      return customer.id;
    } catch (error) {
      throw new Error(`Stripe error: ${error.message}`);
    }
  }
  async renewSubscription(userId: string, subscriptionId: string) {
    const subscription = await this.prisma.subscriptions.findFirst({
      where: { id: subscriptionId, userId },
    });

    if (!subscription) {
      throw new BadRequestException('Assinatura não encontrada.');
    }

    const updatedSubscription = await this.stripe.subscriptions.update(
      subscription.subscriptionId,
      { cancel_at_period_end: false, proration_behavior: 'create_prorations' },
    );

    await this.prisma.subscriptions.update({
      where: { id: subscriptionId },
      data: { hasActiveSubscription: 'ACTIVE', subscriptionEnd: null },
    });

    this.logger.log('assinatura renovada');

    return updatedSubscription;
  }

  async createSubscription(
    userId: string,
    payment_method: string,
    productId: string,
  ) {
    const price = await this.prisma.prices.findFirst({
      where: { product_id: productId },
    });
    if (!price) {
      throw new BadRequestException('Produto não existe');
    }

    const user = await this.prisma.user.findFirst({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('Usuário não encontrado');
    }

    const customerId =
      user.costumerId || (await this.createCustomer(userId, payment_method));

    const stripeSubscriptions = await this.stripe.subscriptions.list({
      customer: customerId,
    });

    const activeSubscription = stripeSubscriptions.data.find(
      (sub) => sub.status === 'active',
    );

    const existingSubscription = await this.prisma.subscriptions.findFirst({
      where: {
        userId,
        hasActiveSubscription: {
          in: ['ACTIVE', 'ACTIVE_UNTIL_END', 'CANCELlED'],
        },
      },
      include: {
        Price: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const validator = existingSubscription
      ? existingSubscription.pricesId === price.id
      : false;

    if (existingSubscription) {
      if (existingSubscription.hasActiveSubscription === 'ACTIVE') {
        if (validator) {
          throw new BadRequestException(
            'Você já possui uma assinatura ativa com este plano.',
          );
        }

        console.log('Atualizando plano...');
        const updatedSubscription = await this.updateSubscription(
          userId,
          productId,
          payment_method,
        );
        return updatedSubscription;
      }

      if (
        ['CANCELLED', 'ACTIVE_UNTIL_END'].includes(
          existingSubscription.hasActiveSubscription,
        )
      ) {
        if (validator) {
          console.log('Renovando assinatura existente...');
          return this.renewSubscription(userId, existingSubscription.id);
        }
        console.log('Cancelando assinatura anterior e criando nova...');
        await this.stripe.subscriptions.cancel(
          existingSubscription.subscriptionId,
        );
      }
    }

    console.log('Criando nova assinatura...');
    await this.addPaymentMethodToCustomer(customerId, payment_method);

    const subscription = await this.stripe.subscriptions.create({
      customer: customerId,
      cancel_at_period_end: false,
      items: [{ price: price.priceId }],
      expand: ['latest_invoice.payment_intent'],
    });

    await this.prisma.subscriptions.create({
      data: {
        subscriptionId: subscription.id,
        userId,
        pricesId: price.id,
        hasActiveSubscription: 'ACTIVE',
      },
    });

    return subscription.id;
  }

  async updateSubscription(
    userId: string,
    productId: string,
    payment_method: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
      include: {
        Subscriptions: {
          where: {
            hasActiveSubscription: 'ACTIVE',
          },
        },
      },
    });
    console.log('user', user);

    if (!user) {
      throw new BadRequestException('Usuário não encontrado');
    }
    if (!user.Subscriptions) {
      throw new BadRequestException('Usuário sem assinatura');
    }

    const pricesId = await this.prisma.prices.findFirst({
      where: { product_id: productId },
    });

    if (!pricesId) {
      throw new BadRequestException('Produto não existe');
    }
    const validatePriceId = user.Subscriptions.some((sub) => {
      return sub.pricesId === pricesId.id;
    });
    console.log('validatePriceId', validatePriceId);
    if (validatePriceId) {
      throw new BadRequestException('User já tem assinatura');
    }

    const payment = await this.prisma.paymentMentMethod.findFirst({
      where: {
        userId,
      },
    });
    if (!payment) {
      throw new BadRequestException('Usuário sem meio de pagamento');
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
          proration_behavior: 'create_prorations',
        },
      );

      return subscription;
    }
    await this.createSubscription(userId, payment_method, productId);
  }

  async cancelSubscription(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
      },
    });
    if (!user || !user.costumerId) {
      throw new BadRequestException('User não encontrado');
    }

    const subscriptionStripe = await this.stripe.subscriptions.list({
      customer: user.costumerId,
    });
    const activeSubscription = subscriptionStripe.data.find(
      (sub) => sub.status === 'active',
    );
    if (!activeSubscription) {
      throw new BadRequestException(
        'Nenhuma assinatura ativa encontrada para este usuário.',
      );
    }

    const subscription = await this.prisma.subscriptions.findFirst({
      where: {
        userId,
        subscriptionId: activeSubscription.id,
      },
    });
    await this.stripe.subscriptions.update(subscription.subscriptionId, {
      cancel_at_period_end: true,
    });
  }

  async createCheckoutSession(
    userId: string,
    successUrl: string,
    cancelUrl: string,
    priceId = 'price_1QK2hx06nRmRVtvs7wEIU6UV',
    token: string,
  ) {
    const user = await this.prisma.user.findFirst({
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
      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(
          event.data.object as Stripe.Subscription,
        );
        break;

      case 'payment_method.attached':
        await this.handlePaymentMethodAttached(
          event.data.object as Stripe.PaymentMethod,
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
    const subscriptionId = invoice.subscription as string;

    const user = await this.prisma.user.findFirst({
      where: { costumerId: customerId },
    });

    if (!user) {
      this.logger.warn(`Usuário não encontrado para o cliente ${customerId}`);
      return;
    }

    await this.prisma.subscriptions.update({
      where: {
        userId_subscriptionId: {
          userId: user.id,
          subscriptionId: subscriptionId,
        },
      },
      data: { hasActiveSubscription: 'ACTIVE' },
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
        data: { hasActiveSubscription: 'INCOMPLETE' },
      });
      this.logger.warn(`Pagamento falhou para o cliente ${customerId}`);
    }
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;
    const subscriptionId = subscription.id;

    const user = await this.prisma.user.findFirst({
      where: { costumerId: customerId },
    });

    if (user) {
      await this.prisma.subscriptions.delete({
        where: {
          userId_subscriptionId: {
            userId: user.id,
            subscriptionId: subscriptionId,
          },
        },
      });
      this.logger.warn(`Assinatura cancelada para o cliente ${customerId}`);
    }
  }
  private async handleSubscriptionCreated(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;
    const subscriptionId = subscription.id;

    const user = await this.prisma.user.findFirst({
      where: { costumerId: customerId },
    });
    await this.prisma.subscriptions.update({
      where: {
        userId_subscriptionId: {
          userId: user.id,
          subscriptionId: subscriptionId,
        },
      },
      data: {
        hasActiveSubscription: 'ACTIVE',
      },
    });
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
  private async handlePaymentMethodAttached(
    paymentMethod: Stripe.PaymentMethod,
  ) {
    const customerId = paymentMethod.customer as string;
    const PaymentMethodId = paymentMethod.id;

    const user = await this.prisma.user.findFirst({
      where: {
        costumerId: customerId,
      },
    });
    await this.prisma.paymentMentMethod.create({
      data: {
        userId: user.id,
        paymentMethodId: PaymentMethodId,
      },
    });
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;
    const periodEnd = subscription.current_period_end;
    const PriceId = subscription.items.data[0]?.price.id;
    const subscriptionId = subscription.id;

    const user = await this.prisma.user.findFirst({
      where: { costumerId: customerId },
    });

    if (!user) {
      this.logger.warn(`Usuário não encontrado para o cliente ${customerId}`);
      return;
    }
    const subscriptionRecord = await this.prisma.subscriptions.findFirst({
      where: { userId: user.id, subscriptionId: subscriptionId },
    });

    if (!subscriptionRecord) {
      this.logger.warn(`Assinatura não encontrada para o usuário ${user.id}`);
      return;
    }

    if (subscription.cancel_at_period_end) {
      const accessExpirationDate = new Date(periodEnd * 1000);

      return await this.prisma.subscriptions.update({
        where: { id: subscriptionRecord.id },
        data: {
          hasActiveSubscription: 'ACTIVE_UNTIL_END',
          subscriptionEnd: accessExpirationDate,
        },
      });
    }

    const newPrice = await this.prisma.prices.findFirst({
      where: {
        priceId: PriceId,
      },
    });

    if (newPrice) {
      await this.prisma.subscriptions.update({
        where: { id: subscriptionRecord.id },
        data: {
          pricesId: newPrice.id,
          hasActiveSubscription: 'ACTIVE',
          subscriptionEnd: null,
        },
      });
    }

    this.logger.log(`Assinatura atualizada para o cliente ${customerId}`);
  }
}
