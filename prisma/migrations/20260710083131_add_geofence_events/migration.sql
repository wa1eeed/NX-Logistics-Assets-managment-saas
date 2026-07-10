-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "geoZoneIds" JSONB;

-- CreateTable
CREATE TABLE "GeofenceEvent" (
    "tenantId" TEXT,
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "geofenceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeofenceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeofenceEvent_tenantId_idx" ON "GeofenceEvent"("tenantId");

-- CreateIndex
CREATE INDEX "GeofenceEvent_assetId_idx" ON "GeofenceEvent"("assetId");

-- CreateIndex
CREATE INDEX "GeofenceEvent_geofenceId_idx" ON "GeofenceEvent"("geofenceId");

-- CreateIndex
CREATE INDEX "GeofenceEvent_tenantId_at_idx" ON "GeofenceEvent"("tenantId", "at");
