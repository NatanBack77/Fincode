import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { StripeService } from './stripe.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { RolesGuard } from 'src/auth/role.guard';
import { Roles } from 'src/auth/roles.decorator';
import { UserType } from 'src/auth/user-type.enum';
import { createProductsController } from './dtos/stripe.dto';

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
    console.log("User", userId);
    await this.stripeService.createCostumers(userId);
  }

  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.Admin, UserType.User)
  @Post('create-subscription')
  async createSubscription(@Req() req, @Body() priceId: string) {
    const userId = req.user.sub;
    await this.stripeService.createSubscription(userId, priceId);
  }
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.Admin, UserType.User)
  @Post('create-checkout-session')
  async createCheckoutSession(
    @Req() req,
    @Body() data: { priceId: string; successUrl: string; cancelUrl: string },
  ) {
    const userId = req.user.sub;
    await this.stripeService.createCheckoutSession(
      userId,
      data.successUrl,
      data.cancelUrl,
      data.priceId,
    );
  }
}
