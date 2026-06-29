// ============================================================
// Shared API contract types (client-agnostic).
// Consumed by apps/web now, apps/driver later.
// ============================================================

import type {
  OrgUnitKind, AssetStatus, OwnershipType, EquipmentRequestStatus, ContractStatus,
  WorkOrderStatus, WorkOrderSource, MaintenanceType, SaleOrderStatus, SupplierDealType,
} from './enums';
import type { CommissioningInfo } from './commissioning';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  roles: string[];
  permissions: string[];
  /** Allowed org-unit ids for row-level scoping; null = global (all units). */
  scopeOrgUnitIds: string[] | null;
}

export interface LoginResponse extends AuthTokens {
  user: AuthUser;
}

export interface UserSummary {
  id: string;
  code: string | null;
  email: string;
  fullName: string;
  isActive: boolean;
  roles: UserRoleAssignment[];
  createdAt: string;
}

export interface UserRoleAssignment {
  id: string;
  roleId: string;
  roleName: string;
  orgUnitId: string | null;
  orgUnitName: string | null;
}

export interface RoleSummary {
  id: string;
  name: string;
  description: string | null;
  permissionKeys: string[];
  userCount: number;
}

export interface OrgUnitNode {
  id: string;
  name: string;
  kind: OrgUnitKind;
  parentId: string | null;
  managerId: string | null;
  isActive: boolean;
  children: OrgUnitNode[];
}

/** Admin-defined custom field on an asset type (rendered on the asset card/forms). */
export interface CustomFieldDef {
  key: string;
  labelEn: string;
  labelAr: string;
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT';
  options?: string[];
}

export interface AssetTypeSummary {
  id: string;
  name: string;
  category: string | null;
  unit: string | null;
  specs: Record<string, unknown> | null;
  customFields: CustomFieldDef[];
  assetClassId: string | null;
  assetClassCode: string | null;
  assetCount: number;
}

// ---------------- Asset classes + model catalog ----------------

export interface AssetClassSummary {
  id: string;
  code: string;
  labelEn: string;
  labelAr: string | null;
  fieldProfile: string; // VEHICLE | EQUIPMENT | GENERIC
  sortOrder: number;
  isActive: boolean;
  typeCount: number;
}

export interface ModelSummary {
  id: string;
  manufacturer: string;
  name: string;
  category: string | null;
  assetTypeId: string;
  assetTypeName: string;
  assetClassCode: string | null;
  isActive: boolean;
  assetCount: number;
}

// ---------------- Cloud storage (Cloudflare R2) ----------------

export interface StorageStatus {
  /** Effective backend: a cloud provider label, or LOCAL when on disk fallback. */
  provider: string;
  /** Where the effective config came from. 'tenant' = this company's own (BYO) bucket. */
  source: 'tenant' | 'db' | 'env' | 'none';
  /** SHARED = folder inside the platform account; DEDICATED = company's own bucket. */
  scope: 'SHARED' | 'DEDICATED' | 'LOCAL';
  bucket: string;
  endpoint: string | null;
  publicBaseUrl: string | null;
  ttl: number;
  /** This company's folder prefix inside the bucket, e.g. tenant_<id>/ */
  folderPrefix: string | null;
}

/** R2 config for the Super Admin form — the secret is never returned. */
export interface R2Settings {
  endpoint: string | null;
  accessKeyId: string | null;
  bucket: string | null;
  publicBaseUrl: string | null;
  ttl: number | null;
  secretSet: boolean;
}

export interface SettingItem {
  key: string;
  value: unknown;
  group: string;
  labelEn: string;
  labelAr: string;
  descriptionEn?: string;
  descriptionAr?: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  ip: string | null;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------- Assets ----------------

export interface AssetFinancial {
  ownershipType: OwnershipType;
  purchasePrice: number | null;
  depreciationRate: number | null; // annual, e.g. 0.2
  manualBookValue: number | null; // user override
  computedBookValue: number | null; // straight-line auto
  effectiveBookValue: number | null; // manual ?? computed
  ageYears: number | null;
}

/** Total cost of ownership / use to date — depreciation + maintenance + external lease. */
export interface AssetTco {
  purchasePrice: number | null;
  effectiveBookValue: number | null;
  accumulatedDepreciation: number | null; // purchasePrice - effectiveBookValue
  maintenanceCost: number; // sum of closed work-order costs
  maintenanceOrders: number; // count of closed work orders
  leaseCost: number; // accrued external lease cost to date
  total: number; // depreciation + maintenance + lease
  costToBookRatio: number | null; // maintenanceCost / effectiveBookValue
}

export interface VehicleDetail {
  plateNumber: string | null;
  vin: string | null;
  registrationExpiry: string | null;
  periodicInspection: string | null;
  insuranceExpiry: string | null;
  operatingCardNo: string | null;
  customsCardNo: string | null;
  currentDriverId: string | null;
}

export interface AssetDocumentItem {
  id: string;
  docType: string;
  fileName: string | null;
  expiryDate: string | null;
  createdAt: string;
  uploadedBy: string | null;
}

export interface AssetSummary {
  id: string;
  code: string;
  assetTypeId: string;
  assetTypeName: string;
  assetClassCode: string | null;
  category: string | null;
  ownershipType: OwnershipType;
  status: AssetStatus;
  forSaleFlag: boolean;
  modelName: string | null;
  manufacturer: string | null;
  year: number | null;
  region: string | null;
  location: string | null;
  plateNumber: string | null;
  serialNo: string | null;
  color: string | null;
  /** Project/unit the asset is currently working for (set when IN_DUTY). */
  currentOrgUnitId: string | null;
  currentOrgUnitName: string | null;
  /** Present only when the caller has finance.read. */
  effectiveBookValue?: number | null;
  createdAt: string;
}

export interface AssetProfile {
  id: string;
  code: string;
  assetTypeId: string;
  assetTypeName: string;
  assetClassCode: string | null;
  assetClassLabelEn: string | null;
  assetClassLabelAr: string | null;
  fieldProfile: string; // VEHICLE | EQUIPMENT | GENERIC
  ownershipType: OwnershipType;
  status: AssetStatus;
  forSaleFlag: boolean;
  modelId: string | null;
  modelName: string | null;
  category: string | null;
  serialNo: string | null;
  capacity: string | null;
  color: string | null;
  manufacturer: string | null;
  year: number | null;
  region: string | null;
  siteName: string | null;
  purchaseDate: string | null;
  location: string | null;
  currentOrgUnitId: string | null;
  /** Admin-defined custom field schema for this asset's type. */
  customFields: CustomFieldDef[];
  /** Values for the custom fields, keyed by field key. */
  customValues: Record<string, unknown>;
  vehicle: VehicleDetail | null;
  documents: AssetDocumentItem[];
  /** Present only when the caller has finance.read. */
  financial?: AssetFinancial;
  /** Present only when the caller has finance.read. */
  tco?: AssetTco;
  commissioning: CommissioningInfo;
  allowedTransitions: AssetStatus[];
  createdAt: string;
  updatedAt: string;
}

// ---------------- Asset operations log ----------------

export interface AssetOperationContract {
  id: string;
  authorizationNo: string;
  orgUnitName: string;
  startDate: string;
  endDate: string;
  status: ContractStatus;
  operatingDays: number; // start → (actual end or now)
}

/** A stretch where the asset was available but not operating (waiting). */
export interface AssetIdleGap {
  fromDate: string;
  toDate: string;
  days: number;
}

export interface AssetOperationsLog {
  generatedAt: string;
  contracts: AssetOperationContract[];
  idleGaps: AssetIdleGap[];
  totals: { contracts: number; operatingDays: number; idleDays: number; utilizationPct: number };
}

// ---------------- Asset timeline (full history of everything on the asset) ----------------

export type AssetTimelineKind =
  | 'CREATED' | 'COMMISSIONED' | 'STATUS_CHANGE' | 'UPDATED'
  | 'REQUEST_RESERVED' | 'CONTRACT_ISSUED' | 'CONTRACT_RETURNED'
  | 'INSPECTION_RECEIPT' | 'INSPECTION_RETURN'
  | 'WORK_ORDER_OPENED' | 'WORK_ORDER_CLOSED'
  | 'SALE_PROPOSED' | 'SALE_LISTED' | 'SALE_SOLD'
  | 'LEASE_STARTED' | 'DOCUMENT';

export interface AssetTimelineEvent {
  kind: AssetTimelineKind;
  at: string;
  reference?: string | null; // ref code / status transition / doc type
  context?: string | null; // project, supplier, signer, reason…
  actor?: string | null; // who did it
}

export interface AssetTimeline {
  generatedAt: string;
  events: AssetTimelineEvent[];
}

// ---------------- Rentals ----------------

export interface EquipmentRequestSummary {
  id: string;
  orgUnitId: string;
  orgUnitName: string;
  assetTypeId: string;
  assetTypeName: string;
  fromDate: string;
  toDate: string;
  status: EquipmentRequestStatus;
  requestedBy: string;
  decidedBy: string | null;
  reservedAssetId: string | null;
  reservedAssetCode: string | null;
  notes: string | null;
  contractId: string | null;
  createdAt: string;
}

export interface RentalContractSummary {
  id: string;
  authorizationNo: string;
  assetId: string;
  assetCode: string;
  assetTypeName: string;
  orgUnitId: string;
  orgUnitName: string;
  startDate: string;
  endDate: string;
  status: ContractStatus;
  daysRemaining: number;
  /** Present only when the caller has finance.read. */
  internalRate?: number | null;
  createdAt: string;
}

export interface CustodyView {
  expiryThresholdDays: number;
  summary: { active: number; expiringSoon: number; overdue: number };
  contracts: RentalContractSummary[];
}

// ---------------- Maintenance ----------------

export interface MaintenancePart {
  name: string;
  quantity?: number | null;
  cost?: number | null;
}

export interface MaintenanceCardData {
  worksDone: string | null;
  parts: MaintenancePart[];
  technician: string | null;
  laborHours: number | null;
}

export interface WorkOrderSummary {
  id: string;
  refNo: string | null;
  assetId: string;
  assetCode: string;
  assetTypeName: string;
  source: WorkOrderSource;
  type: MaintenanceType;
  status: WorkOrderStatus;
  priority: string | null;
  description: string | null;
  totalCost: number | null;
  hasCard: boolean;
  documentCount: number;
  openedBy: string | null;
  closedBy: string | null;
  openedAt: string;
  closedAt: string | null;
}

export interface WorkOrderDetail extends WorkOrderSummary {
  card: MaintenanceCardData | null;
  documents: AssetDocumentItem[];
}

// ---------------- Fleet KPIs (executive dashboard) ----------------

export interface KpiBucket {
  key: string;
  count: number;
  pct: number;
}

export interface RegionReadiness {
  region: string;
  total: number;
  operating: number;
  nonOperating: number;
  readinessPct: number;
}

// ---------------- Disposal / Sale ----------------

export interface SaleOrderSummary {
  id: string;
  refNo: string | null;
  assetId: string;
  assetCode: string;
  assetTypeName: string;
  status: SaleOrderStatus;
  buyerName: string | null;
  proposedBy: string | null;
  approvedBy: string | null;
  listedAt: string | null;
  soldAt: string | null;
  createdAt: string;
  /** Financial fields — present only when caller has finance.read. */
  askingPrice?: number | null;
  salePrice?: number | null;
  bookValue?: number | null;
  profitLoss?: number | null;
}

// ---------------- Suppliers & External lease ----------------

export interface SupplierSummary {
  id: string;
  name: string;
  dealType: SupplierDealType;
  contact: Record<string, unknown> | null;
  leaseCount: number;
  createdAt: string;
}

export interface ExternalLeaseSummary {
  id: string;
  refNo: string | null;
  assetId: string;
  assetCode: string;
  supplierId: string;
  supplierName: string;
  ratePeriod: string;
  startDate: string;
  endDate: string;
  maintenanceBearer: string | null;
  insuranceBearer: string | null;
  returnObligation: boolean;
  daysRemaining: number;
  /** Financial — present only when caller has finance.read. */
  periodicRate?: number | null;
}

// ---------------- Drivers ----------------

export interface DriverSummary {
  id: string;
  fullName: string;
  iqamaNumber: string | null;
  licenseExpiry: string | null;
  iqamaExpiry: string | null;
  isActive: boolean;
  assignedVehicleCode: string | null;
  createdAt: string;
}

// ---------------- Alerts (notifications) ----------------

export type AlertKind =
  | 'DOC_EXPIRY' | 'REGISTRATION_EXPIRY' | 'INSPECTION_EXPIRY' | 'CONTRACT_EXPIRY'
  | 'LEASE_EXPIRY' | 'DRIVER_DOC_EXPIRY' | 'MAINTENANCE_COST' | 'SUPPLY_SHORTAGE'
  | 'INSURANCE_EXPIRY' | 'PREVENTIVE_DUE';

export interface AlertItem {
  kind: AlertKind;
  severity: 'warning' | 'danger';
  title: string;
  reference: string;
  date: string | null;
  daysRemaining: number | null;
  entityType: string;
  entityId: string;
}

export interface AlertsView {
  generatedAt: string;
  counts: { total: number; danger: number; warning: number };
  items: AlertItem[];
}

export interface FleetKpis {
  generatedAt: string;
  totals: {
    total: number;
    operating: number;
    stopped: number;
    underRepair: number;
    forSale: number;
    requiresDecision: number;
    readinessPct: number;
  };
  coverage: { regions: number; sites: number; assetTypes: number; manufacturers: number };
  statusDistribution: KpiBucket[];
  regions: RegionReadiness[];
  byCategory: KpiBucket[];
  byType: KpiBucket[];
  ageStructure: KpiBucket[];
  topManufacturers: KpiBucket[];
  nonOperatingConcentration: KpiBucket[];
  dataQuality: { total: number; withoutPlate: number; undefinedYear: number };
}

// ---------------- Department KPIs ----------------

/** Maintenance department dashboard: cost, MTTR, preventive vs corrective. */
export interface MaintenanceKpis {
  generatedAt: string;
  totals: { open: number; inProgress: number; closed: number; cancelled: number; total: number };
  cost: { total: number; closedOrders: number; avgPerClosedOrder: number | null };
  preventiveVsCorrective: { preventive: number; corrective: number; preventivePct: number };
  mttrDays: number | null; // mean closedAt − openedAt over closed orders
  topCostAssets: { assetId: string; assetCode: string; cost: number; orders: number }[];
}

/** Dispatch / operations dashboard: utilization and request pipeline. */
export interface DispatchKpis {
  generatedAt: string;
  fleet: { total: number; inDuty: number; available: number; reserved: number };
  utilizationPct: number; // inDuty / (inDuty + available + reserved)
  requests: { pending: number; approved: number; fulfilled: number; rejected: number; total: number };
  activeContracts: number;
  topProjects: { orgUnitId: string; orgUnitName: string; activeContracts: number }[];
}
