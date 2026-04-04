import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';
import { resolve } from 'node:path';

loadEnv({ path: resolve(__dirname, '../.env') });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
