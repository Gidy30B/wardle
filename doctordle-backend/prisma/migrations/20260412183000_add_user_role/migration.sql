ALTER TABLE "User"
ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';

CREATE INDEX "User_role_idx" ON "User"("role");
