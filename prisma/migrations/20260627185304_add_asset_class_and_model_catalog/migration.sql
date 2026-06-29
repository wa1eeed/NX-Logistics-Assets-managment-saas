-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "capacity" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "modelId" TEXT,
ADD COLUMN     "serialNo" TEXT;

-- AlterTable
ALTER TABLE "AssetType" ADD COLUMN     "assetClassId" TEXT;

-- AlterTable
ALTER TABLE "VehicleDetail" ADD COLUMN     "vin" TEXT;

-- CreateTable
CREATE TABLE "AssetClass" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "labelAr" TEXT,
    "fieldProfile" TEXT NOT NULL DEFAULT 'GENERIC',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Model" (
    "id" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "assetTypeId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Model_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssetClass_code_key" ON "AssetClass"("code");

-- CreateIndex
CREATE INDEX "Model_assetTypeId_idx" ON "Model"("assetTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "Model_manufacturer_name_key" ON "Model"("manufacturer", "name");

-- CreateIndex
CREATE INDEX "Asset_modelId_idx" ON "Asset"("modelId");

-- CreateIndex
CREATE INDEX "AssetType_assetClassId_idx" ON "AssetType"("assetClassId");

-- AddForeignKey
ALTER TABLE "AssetType" ADD CONSTRAINT "AssetType_assetClassId_fkey" FOREIGN KEY ("assetClassId") REFERENCES "AssetClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Model" ADD CONSTRAINT "Model_assetTypeId_fkey" FOREIGN KEY ("assetTypeId") REFERENCES "AssetType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE SET NULL ON UPDATE CASCADE;

