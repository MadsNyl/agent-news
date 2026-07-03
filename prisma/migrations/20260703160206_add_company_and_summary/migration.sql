-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "companyId" UUID,
ADD COLUMN     "summary" TEXT;

-- CreateTable
CREATE TABLE "Company" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_domain_key" ON "Company"("domain");

-- CreateIndex
CREATE INDEX "Article_companyId_idx" ON "Article"("companyId");

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
