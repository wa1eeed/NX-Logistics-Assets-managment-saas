-- AlterTable: commissioning fields + default status
ALTER TABLE "Asset" ADD COLUMN     "commissionedAt" TIMESTAMP(3),
ADD COLUMN     "commissionedBy" TEXT,
ADD COLUMN     "commissioning" JSONB,
ALTER COLUMN "status" SET DEFAULT 'COMMISSIONING';
