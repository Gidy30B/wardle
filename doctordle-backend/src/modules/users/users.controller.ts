import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/authenticated-request.interface';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me/profile')
  async getMyProfile(@Req() req: AuthenticatedRequest) {
    return this.usersService.getMyProfile(req.user.id);
  }

  @Patch('me/profile')
  async updateMyProfile(
    @Req() req: AuthenticatedRequest,
    @Body() body: UpdateMyProfileDto,
  ) {
    return this.usersService.updateMyProfile(req.user.id, body);
  }
}
