-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "manufacturer" TEXT,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "siteName" TEXT;

-- AlterTable
ALTER TABLE "AssetType" ADD COLUMN     "category" TEXT;

-- CreateIndex
CREATE INDEX "AssetType_category_idx" ON "AssetType"("category");
