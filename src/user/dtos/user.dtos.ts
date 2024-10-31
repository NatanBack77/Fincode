import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { IsStrongerPassword } from 'src/common/validators/Stronger-Password';

export class User {
  @ApiProperty()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsNotEmpty()
  email: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @IsStrongerPassword()
  password: string;
}
export class GetIdUser {
  @ApiProperty()
  @IsUUID()
  id: string;
}
