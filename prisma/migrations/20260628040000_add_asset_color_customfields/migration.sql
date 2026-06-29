-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "color" TEXT,
ADD COLUMN     "customValues" JSONB;

-- AlterTable
ALTER TABLE "AssetType" ADD COLUMN     "customFields" JSONB;

