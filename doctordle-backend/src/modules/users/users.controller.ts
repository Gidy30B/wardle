import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/authenticated-request.interface';
import { OnboardingOrganizationDto } from './dto/onboarding-organization.dto';
import { OnboardingProfileDto } from './dto/onboarding-profile.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { UpdateMySettingsDto } from './dto/update-my-settings.dto';
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

  @Get('me/onboarding')
  async getMyOnboarding(@Req() req: AuthenticatedRequest) {
    return this.usersService.getMyOnboarding(req.user.id);
  }

  @Post('me/onboarding/profile')
  async updateMyOnboardingProfile(
    @Req() req: AuthenticatedRequest,
    @Body() body: OnboardingProfileDto,
  ) {
    return this.usersService.saveOnboardingProfile(req.user.id, body);
  }

  @Post('me/onboarding/individual')
  async completeMyOnboardingAsIndividual(@Req() req: AuthenticatedRequest) {
    return this.usersService.completeOnboardingAsIndividual(req.user.id);
  }

  @Post('me/onboarding/organization')
  async completeMyOnboardingWithOrganization(
    @Req() req: AuthenticatedRequest,
    @Body() body: OnboardingOrganizationDto,
  ) {
    return this.usersService.completeOnboardingWithOrganization(req.user.id, body);
  }

  @Get('me/settings')
  async getMySettings(@Req() req: AuthenticatedRequest) {
    return this.usersService.getMySettings(req.user.id);
  }

  @Patch('me/settings')
  async updateMySettings(
    @Req() req: AuthenticatedRequest,
    @Body() body: UpdateMySettingsDto,
  ) {
    return this.usersService.updateMySettings(req.user.id, body);
  }
}
