import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Query,
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
  createCustomer,
  createPaymentMethod,
  // createPaymentMethod,
  createProductsController,
  createSubscription,
  UpdateSubscription,
  UpdateSubscriptionQuery,
} from './dtos/stripe.dto';
import { Request, Response } from 'express';
import Stripe from 'stripe';
import { SubscriptionGuard } from 'src/auth/subscription.guard';

@ApiTags('stripe')
@Controller('stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.Admin, UserType.User)
  @Get('me')
  async getMySubscription(@Req() req) {
    const userId = req.user.sub;
    console.log(userId);
    const subscription = await this.stripeService.getUserSubscription(userId);
    return subscription;
  }

  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.Admin, UserType.User)
  @Post('payment')
  async createPaymentMethod(@Body() data: createPaymentMethod) {
    return await this.stripeService.crateTokenPayment(data);
  }

  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.Admin, UserType.User)
  @Get('products')
  async getAllProducts() {
    const products = await this.stripeService.getAllProduct();
    console.log(JSON.stringify(products, null, 4));
    return products;
  }
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
    await this.stripeService.createPrice(
      Price,
      productId.dbProductId,
      productId.stripeProductId,
    );
  }
  // @HttpCode(HttpStatus.CREATED)
  // @ApiBearerAuth()
  // @UseGuards(AuthGuard, RolesGuard)
  // @Roles(UserType.Admin, UserType.User)
  // @Post('create-paymentMethod')
  // async createPaymentMethod(@Body() data: createPaymentMethod) {
  //   await this.stripeService.createPaymentMethod(data);
  // }

  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.Admin, UserType.User)
  @Post('create-customer')
  async createCustomer(@Req() req, @Body() data: createCustomer) {
    const userId = req.user.sub;
    await this.stripeService.createCustomer(userId, data.paymentMethodId);
  }

  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.Admin, UserType.User)
  @Post('create-subscription')
  async createSubscription(@Req() req, @Body() data: createSubscription) {
    const userId = req.user.sub;

    await this.stripeService.createSubscription(
      userId,
      data.paymentMethodId,
      data.productId,
    );
  }

  // @HttpCode(HttpStatus.CREATED)
  // @ApiBearerAuth()
  // @UseGuards(AuthGuard, RolesGuard)
  // @Roles(UserType.Admin, UserType.User)
  // @Post('create-checkout-session')
  // async createCheckoutSession(@Req() req, @Body() data: CreateCheckoutSession) {
  //   const userId = req.user.sub;

  //   const checkout = await this.stripeService.createCheckoutSession(
  //     userId,
  //     data.successUrl,
  //     data.cancelUrl,
  //     data.priceId,
  //     data.token,
  //   );
  //   return checkout.url;
  // }
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.Admin, UserType.User)
  @Post('update-subscription')
  async updateSubscription(
    @Req() req,
    @Query() query: UpdateSubscriptionQuery,
    @Body() updateSubscriptionDto: UpdateSubscription,
  ) {
    const userId = req.user.sub;
    return await this.stripeService.updateSubscription(
      userId,
      query.priceId,
      updateSubscriptionDto.paymentMethodId,
    );
  }

  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.Admin, UserType.User)
  @Delete('delete-subscription')
  async deleteSubscription(@Req() req) {
    const userId = req.user.sub;
    await this.stripeService.deleteSubscription(userId);
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
  @UseGuards(AuthGuard, RolesGuard, SubscriptionGuard)
  @Roles(UserType.Admin, UserType.User)
  @SubscriptionProducts('al2')
  @Get('test')
  async test(@Res() res: Response) {
    return res.send('hello world');
  }
}
