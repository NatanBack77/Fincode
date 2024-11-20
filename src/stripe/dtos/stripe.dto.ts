import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUrl,
  IsUUID,
} from 'class-validator';

enum Interval {
  day = 'day',
  week = 'week',
  month = 'month',
  year = 'year',
}
export class createProducts {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  description: string;
}
export class CreatePrice {
  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  unitAmout: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  currency: string;

  @ApiProperty({ enum: Interval })
  @IsNotEmpty()
  @IsEnum(Interval)
  interval: Interval;
}
export class createProductsController {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  unitAmout: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  currency: string;

  @ApiProperty({ enum: Interval })
  @IsNotEmpty()
  @IsEnum(Interval)
  interval: Interval;
}

export class createPaymentMethod {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  number: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  exp_month: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  exp_year: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  cvc: string;
}
export class createSubscription {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  productId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  paymentMethodId: string;
}
export class createCustomer {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  paymentMethodId: string;
}

export class CreateCheckoutSession {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  priceId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @IsUrl()
  successUrl: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @IsUrl()
  cancelUrl: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  paymentMethodId: string;
}
export class GetUserId {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  id: string;
}
export class UpdateSubscription {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  paymentMethodId: string;
}
export class UpdateSubscriptionQuery {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  priceId: string;
}
