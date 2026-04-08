import { Controller, Get, UseGuards } from '@nestjs/common';
import { InternalApiGuard } from '../../auth/internal-api.guard';
import { QUEUE_NAME } from './queue.constants';
import { QueueService } from './queue.service';

@Controller('internal/queue')
@UseGuards(InternalApiGuard)
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get('health')
  async health() {
    const counts = await this.queueService.getHealth();

    return {
      queue: QUEUE_NAME,
      counts,
    };
  }
}
