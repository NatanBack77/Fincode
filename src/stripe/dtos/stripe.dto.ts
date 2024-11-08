import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsString } from 'class-validator';

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
export class GetUserId {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  id: string;
}
