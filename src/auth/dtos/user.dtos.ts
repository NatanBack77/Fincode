import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEmail } from 'class-validator';
import { IsStrongerPassword } from 'src/common/validators/Stronger-Password';

export class UserAuth {
  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  password: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'O token não pode estar vazio' })
  token: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @IsStrongerPassword()
  newPassword: string;
}
export class RequestResetPasswordDto {
  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
