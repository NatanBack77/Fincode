import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  RawBodyRequest,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { StripeService } from './stripe.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { RolesGuard } from 'src/auth/role.guard';
import { Roles, SubscriptionProducts } from 'src/auth/roles.decorator';
import { UserType } from 'src/auth/user-type.enum';
import {
  CreateCheckoutSession,
  createProductsController,
  createSubscription,
} from './dtos/stripe.dto';
import { Request, Response } from 'express';
import Stripe from 'stripe';

@ApiTags('stripe')
@Controller('stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.Admin, UserType.User)
  @Post()
  async createProduct(@Body() data: createProductsController) {
    const product = {
      name: data.name,
      description: data.description,
    };
    const Price = {
      unitAmout: data.unitAmout,
      currency: data.currency,
      interval: data.interval,
    };
    const productId = await this.stripeService.createProduct(product);
    await this.stripeService.CreatePrice(
      productId.dbProductId,
      productId.stripeProductId,
      Price,
    );
  }

  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.Admin, UserType.User)
  @Post('create-customer')
  async createCustomer(@Req() req) {
    const userId = req.user.sub;
    console.log('User', userId);
    await this.stripeService.createCostumers(userId);
  }

  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.Admin, UserType.User)
  @Post('create-subscription')
  async createSubscription(@Req() req, @Body() data: createSubscription) {
    const userId = req.user.sub;
    console.log('user', userId);

    await this.stripeService.createSubscription(userId, data.priceId);
  }
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.Admin, UserType.User)
  @Post('create-checkout-session')
  async createCheckoutSession(@Req() req, @Body() data: CreateCheckoutSession) {
    const userId = req.user.sub;

    const checkout = await this.stripeService.createCheckoutSession(
      userId,
      data.successUrl,
      data.cancelUrl,
      data.priceId,
    );
    return checkout.url;
  }
  @HttpCode(HttpStatus.CREATED)
  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
  ) {
    const sigHeader = req.headers['stripe-signature'];
    if (Array.isArray(sigHeader)) {
      return res.status(400).json({ error: 'Invalid Stripe signature format' });
    }
    const sig = sigHeader as string;

    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!sig || !endpointSecret) {
      return res
        .status(400)
        .json({ error: 'Missing Stripe signature or endpoint secret' });
    }
    let event: Stripe.Event;
    try {
      const rawBody = req.rawBody;

      event = this.stripeService.constructWebhookEvent(
        rawBody,
        sig,
        endpointSecret,
      );
    } catch (err) {
      console.error('Erro ao validar webhook Stripe:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    await this.stripeService.handleWebhook(event);
    res.status(200).json({ received: true });
  }
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard, SubscriptionProducts)
  @Roles(UserType.Admin, UserType.User)
  @SubscriptionProducts('al2')
  @Get('test')
  async test(@Res() res: Response) {
    return res.send('hello world');
  }
}
