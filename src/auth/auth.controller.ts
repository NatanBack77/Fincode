import {
  Controller,
  Get,
  HttpStatus,
  HttpCode,
  UseGuards,
  Body,
  Post,
  BadRequestException,
  Req,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { UserAuth } from './dtos/user.dtos';
import { UserService } from 'src/user/user.service';
import * as bcrypt from 'bcrypt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private userService: UserService,
  ) {}
  @HttpCode(HttpStatus.OK)
  @Post()
  async signIn(@Body() userDto: UserAuth) {
    const validator = await this.userService.findUserByEmail(userDto.email);
    if (!validator) {
      throw new BadRequestException('usuário ou senha incorreta');
    }
    const isEqualPassword = await bcrypt.compare(
      userDto.password,
      validator.password,
    );

    if (!isEqualPassword) {
      throw new BadRequestException('usuário ou senha incorreta');
    }
    const token = await this.authService.generateToken({ sub: validator.id });
    return { access_token: token };
  }
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    const token = req.headers['authorization']?.split(' ')[1]; // Acessa o cabeçalho corretamente

    if (!token) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ message: 'Token não fornecido' });
    }

    await this.authService.logout(token);

    return res.status(HttpStatus.OK).json({ message: 'Logout bem-sucedido' });
  }
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @Get('/me')
  async me(@Req() req): Promise<any> {
    const userIdentify = await this.userService.findUserById(req.user.sub);
    const User = {
      id: userIdentify.id,
      name: userIdentify.name,
      email: userIdentify.email,
      user_Role: userIdentify.user_Role,
    };
    return User;
  }
}
