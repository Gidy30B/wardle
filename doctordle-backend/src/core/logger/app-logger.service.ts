import { Injectable } from '@nestjs/common';
import pino, { Logger } from 'pino';
import { getEnv } from '../config/env.validation';

@Injectable()
export class AppLoggerService {
  private readonly logger: Logger = pino({
    name: 'doctordle-backend',
    level: getEnv().LOG_LEVEL,
  });

  info(payload: object, message?: string): void {
    this.logger.info(payload, message);
  }

  warn(payload: object, message?: string): void {
    this.logger.warn(payload, message);
  }

  error(payload: object, message?: string): void {
    this.logger.error(payload, message);
  }
}
