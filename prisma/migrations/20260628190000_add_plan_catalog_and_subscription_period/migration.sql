-- AlterTable: subscription plan link + period + per-vehicle + asset cap
ALTER TABLE "TenantSubscription" ADD COLUMN     "assetCap" INTEGER,
ADD COLUMN     "currentPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "currentPeriodStart" TIMESTAMP(3),
ADD COLUMN     "perVehiclePrice" DECIMAL(10,2),
ADD COLUMN     "planId" TEXT,
ADD COLUMN     "renewsAt" TIMESTAMP(3);

-- CreateTable: platform-managed plan catalog
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seats" INTEGER NOT NULL DEFAULT 5,
    "storageGb" INTEGER NOT NULL DEFAULT 10,
    "features" JSONB NOT NULL DEFAULT '{}',
    "priceMonthly" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "perVehiclePrice" DECIMAL(10,2),
    "assetCap" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");
