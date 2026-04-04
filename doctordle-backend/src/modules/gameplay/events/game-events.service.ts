import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { GameCompletedEvent } from './game-completed.event';

@Injectable()
export class GameEventsService {
  private readonly emitter = new EventEmitter();

  emitGameCompleted(event: GameCompletedEvent): void {
    setImmediate(() => {
      this.emitter.emit('game.completed', event);
    });
  }

  onGameCompleted(listener: (event: GameCompletedEvent) => void): void {
    this.emitter.on('game.completed', listener);
  }
}
