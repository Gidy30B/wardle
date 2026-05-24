import { MODULE_METADATA } from '@nestjs/common/constants';
import { readFileSync } from 'fs';
import { join } from 'path';
import { RedisCacheModule } from './redis-cache.module';
import { RedisCacheService } from './redis-cache.service';

describe('RedisCacheModule', () => {
  it('exports RedisCacheService from the shared cache module', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      RedisCacheModule,
    );
    const exports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      RedisCacheModule,
    );

    expect(providers).toContain(RedisCacheService);
    expect(exports).toContain(RedisCacheService);
  });

  it('keeps feature modules from directly providing RedisCacheService', () => {
    const featureModulePaths = [
      'modules/ai/ai.module.ts',
      'modules/gameplay/gameplay.module.ts',
      'modules/gameplay/daily-cases.module.ts',
      'modules/diagnostics/diagnostics.module.ts',
      'modules/users/users.module.ts',
      'modules/queue/queue-worker.module.ts',
      'modules/queue/ai-worker.module.ts',
    ];

    for (const modulePath of featureModulePaths) {
      const source = readFileSync(join(process.cwd(), 'src', modulePath), 'utf8');

      expect(source).not.toMatch(/providers:\s*\[[^\]]*RedisCacheService/s);
    }
  });
});
