require('dotenv/config');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { CasesService } = require('../dist/modules/cases/cases.service');

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const casesService = app.get(CasesService);

    const resetResult = await casesService.resetTodayCase();
    const rebuildResult = await casesService.rebuildTodayCase();

    console.log(`RESET_RESULT=${JSON.stringify(resetResult)}`);
    console.log(
      `REBUILD_RESULT=${JSON.stringify({
        dailyCaseId: rebuildResult.dailyCaseId,
        caseId: rebuildResult.caseId,
        date: rebuildResult.date.toISOString(),
      })}`,
    );
  } finally {
    await app.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
