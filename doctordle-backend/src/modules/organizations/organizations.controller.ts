import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/authenticated-request.interface';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { SearchOrganizationsDto } from './dto/search-organizations.dto';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  async search(@Query() query: SearchOrganizationsDto) {
    return this.organizationsService.searchOrganizations(query.query);
  }

  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateOrganizationDto,
  ) {
    return this.organizationsService.createOrganization({
      userId: req.user.id,
      name: body.name,
      type: body.type,
    });
  }

  @Get('me')
  async me(@Req() req: AuthenticatedRequest) {
    return this.organizationsService.getUserOrganizations(req.user.id);
  }

  @Post(':id/join')
  async join(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.organizationsService.joinOrganization(req.user.id, id);
  }
}
