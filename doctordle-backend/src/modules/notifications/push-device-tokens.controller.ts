import { Body, Controller, Delete, Param, Post, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/authenticated-request.interface';
import { RegisterPushDeviceTokenDto } from './dto/register-push-device-token.dto';
import { PushDeviceTokensService } from './push-device-tokens.service';

@Controller('notifications/push-tokens')
export class PushDeviceTokensController {
  constructor(private readonly pushDeviceTokens: PushDeviceTokensService) {}

  @Post()
  register(
    @Req() req: AuthenticatedRequest,
    @Body() body: RegisterPushDeviceTokenDto,
  ) {
    return this.pushDeviceTokens.registerForUser(req.user.id, body);
  }

  @Delete(':token')
  disable(@Req() req: AuthenticatedRequest, @Param('token') token: string) {
    return this.pushDeviceTokens.disableForUser(req.user.id, token);
  }
}
