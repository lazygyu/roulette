import { Controller, Post, Body, UseGuards, Request, SerializeOptions } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { User } from '@prisma/client';
import { LoginResponseDto } from './dto/login-response.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Post('register')
  @SerializeOptions({ type: LoginResponseDto })
  async register(@Body() createUserDto: CreateUserDto): Promise<LoginResponseDto> {
    const user = await this.usersService.create(createUserDto);
    return this.authService.login(user);
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @SerializeOptions({ type: LoginResponseDto })
  async login(@Request() req: { user: User }): Promise<LoginResponseDto> {
    // console.log(req);
    return this.authService.login(req.user);
  }
}
