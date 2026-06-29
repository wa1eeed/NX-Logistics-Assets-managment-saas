// ============================================================
// Tenant self-service — public company registration + per-tenant branding.
// ============================================================

/** Public self-signup payload: creates a company + its first admin. */
export interface RegisterCompanyDto {
  companyName: string;
  slug: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  // بيانات الشركة الاختيارية عند التسجيل (تُكمَّل لاحقًا من ملف الشركة)
  email?: string | null;
  contactPhone?: string | null;
  city?: string | null;
  crNumber?: string | null;
  vatNumber?: string | null;
}

/** Company account / legal profile (also the "buyer" fields on a tax invoice). */
export interface TenantProfile {
  name: string;
  legalName: string | null;
  email: string | null;
  contactPhone: string | null;
  city: string | null;
  crNumber: string | null;
  vatNumber: string | null;
}

export interface UpdateTenantProfileDto {
  legalName?: string | null;
  email?: string | null;
  contactPhone?: string | null;
  city?: string | null;
  crNumber?: string | null;
  vatNumber?: string | null;
}

/** Branding the company admin can customise (applied across the app shell). */
export interface TenantBranding {
  /** Display name shown in the shell (falls back to the legal company name). */
  brandName: string | null;
  /** Brand accent colour as a hex string (e.g. #0EA5E9); themes the primary colour. */
  primaryColor: string | null;
  /** Short-lived URL for the uploaded logo, or null if none. */
  logoUrl: string | null;
}

export interface UpdateTenantBrandingDto {
  brandName?: string | null;
  primaryColor?: string | null;
}

/** The signed-in user's tenant, incl. branding + company profile — used to theme the shell. */
export interface TenantMe {
  id: string;
  code: string;
  name: string;
  status: string;
  branding: TenantBranding;
  profile: TenantProfile;
}
