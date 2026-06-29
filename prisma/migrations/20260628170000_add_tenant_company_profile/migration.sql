-- AlterTable: company account / tax-invoice buyer fields on Tenant
ALTER TABLE "Tenant" ADD COLUMN     "city" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "crNumber" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "vatNumber" TEXT;
