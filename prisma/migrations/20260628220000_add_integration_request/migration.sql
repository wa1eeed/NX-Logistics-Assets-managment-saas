-- CreateTable
CREATE TABLE "IntegrationRequest" (
    "tenantId" TEXT,
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'WASL',
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "requestedBy" TEXT,
    "notes" TEXT,
    "handledBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationRequest_tenantId_idx" ON "IntegrationRequest"("tenantId");

