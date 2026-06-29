-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "trackingEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TrackingAddon" (
    "tenantId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ADDON',
    "vehicleQuota" INTEGER NOT NULL DEFAULT 0,
    "perVehiclePrice" DECIMAL(10,2),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackingAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingDevice" (
    "tenantId" TEXT,
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'HARDWARE',
    "externalId" TEXT NOT NULL,
    "signingKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackingDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationPing" (
    "tenantId" TEXT,
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "deviceId" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "speed" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'HARDWARE',
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocationPing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Geofence" (
    "tenantId" TEXT,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CIRCLE',
    "geo" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Geofence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackingAddon_tenantId_key" ON "TrackingAddon"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingDevice_externalId_key" ON "TrackingDevice"("externalId");

-- CreateIndex
CREATE INDEX "TrackingDevice_tenantId_idx" ON "TrackingDevice"("tenantId");

-- CreateIndex
CREATE INDEX "TrackingDevice_assetId_idx" ON "TrackingDevice"("assetId");

-- CreateIndex
CREATE INDEX "LocationPing_assetId_recordedAt_idx" ON "LocationPing"("assetId", "recordedAt");

-- CreateIndex
CREATE INDEX "LocationPing_tenantId_idx" ON "LocationPing"("tenantId");

-- CreateIndex
CREATE INDEX "Geofence_tenantId_idx" ON "Geofence"("tenantId");

