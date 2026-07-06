-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('ARTICLE', 'VIDEO');

-- AlterTable
ALTER TABLE "Article" ADD COLUMN "contentType" "ContentType" NOT NULL DEFAULT 'ARTICLE',
ADD COLUMN "videoEmbedUrl" TEXT,
ADD COLUMN "videoDuration" INTEGER;
