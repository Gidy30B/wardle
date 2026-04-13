import { Controller, Get, UseGuards } from '@nestjs/common';
import { InternalApiGuard } from '../../auth/internal-api.guard';
import { QueueService } from './queue.service';

@Controller('internal/queue')
@UseGuards(InternalApiGuard)
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get('health')
  async health() {
    const queues = await this.queueService.getHealth();

    return {
      queues,
    };
  }
}
