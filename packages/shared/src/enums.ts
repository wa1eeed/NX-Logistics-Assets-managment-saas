// ============================================================
// Domain enums — mirror prisma/schema.prisma exactly.
// Kept framework-agnostic so apps/api, apps/web and (later)
// apps/driver can all import the same source of truth.
// ============================================================

export const OwnershipType = {
  OWNED: 'OWNED',
  EXTERNALLY_RENTED: 'EXTERNALLY_RENTED',
} as const;
export type OwnershipType = (typeof OwnershipType)[keyof typeof OwnershipType];

export const AssetStatus = {
  COMMISSIONING: 'COMMISSIONING', // قيد التجهيز — لم يُؤكَّد جاهزيته بعد
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  IN_DUTY: 'IN_DUTY',
  UNDER_MAINTENANCE: 'UNDER_MAINTENANCE',
  OUT_OF_SERVICE: 'OUT_OF_SERVICE',
  FOR_SALE: 'FOR_SALE',
  DISPOSED: 'DISPOSED',
} as const;
export type AssetStatus = (typeof AssetStatus)[keyof typeof AssetStatus];

export const OrgUnitKind = {
  DIVISION: 'DIVISION',
  DEPARTMENT: 'DEPARTMENT',
  PROJECT: 'PROJECT',
} as const;
export type OrgUnitKind = (typeof OrgUnitKind)[keyof typeof OrgUnitKind];

export const EquipmentRequestStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  FULFILLED: 'FULFILLED',
} as const;
export type EquipmentRequestStatus =
  (typeof EquipmentRequestStatus)[keyof typeof EquipmentRequestStatus];

export const ContractStatus = {
  ACTIVE: 'ACTIVE',
  EXTENDED: 'EXTENDED',
  RETURNED: 'RETURNED',
  CANCELLED: 'CANCELLED',
} as const;
export type ContractStatus = (typeof ContractStatus)[keyof typeof ContractStatus];

export const InspectionKind = {
  RECEIPT: 'RECEIPT',
  RETURN: 'RETURN',
} as const;
export type InspectionKind = (typeof InspectionKind)[keyof typeof InspectionKind];

export const WorkOrderStatus = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
} as const;
export type WorkOrderStatus = (typeof WorkOrderStatus)[keyof typeof WorkOrderStatus];

export const WorkOrderSource = {
  PROJECT: 'PROJECT',
  DISPATCH: 'DISPATCH',
  PERIODIC: 'PERIODIC',
  BREAKDOWN: 'BREAKDOWN',
} as const;
export type WorkOrderSource = (typeof WorkOrderSource)[keyof typeof WorkOrderSource];

export const MaintenanceType = {
  PREVENTIVE: 'PREVENTIVE',
  CORRECTIVE: 'CORRECTIVE',
} as const;
export type MaintenanceType = (typeof MaintenanceType)[keyof typeof MaintenanceType];

export const SaleOrderStatus = {
  PROPOSED: 'PROPOSED',
  APPROVED: 'APPROVED',
  LISTED: 'LISTED',
  SOLD: 'SOLD',
  CANCELLED: 'CANCELLED',
} as const;
export type SaleOrderStatus = (typeof SaleOrderStatus)[keyof typeof SaleOrderStatus];

export const SupplierDealType = {
  SALE: 'SALE',
  RENTAL: 'RENTAL',
  BOTH: 'BOTH',
} as const;
export type SupplierDealType = (typeof SupplierDealType)[keyof typeof SupplierDealType];

export const DocumentEntityType = {
  ASSET: 'ASSET',
  CONTRACT: 'CONTRACT',
  WORK_ORDER: 'WORK_ORDER',
  DRIVER: 'DRIVER',
  SALE_ORDER: 'SALE_ORDER',
  EXTERNAL_LEASE: 'EXTERNAL_LEASE',
} as const;
export type DocumentEntityType =
  (typeof DocumentEntityType)[keyof typeof DocumentEntityType];
