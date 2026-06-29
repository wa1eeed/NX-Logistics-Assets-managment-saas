/**
 * The request principal attached to req.user after JWT validation.
 * Mirrors @nx-lam/shared AuthUser but is the server-side canonical form.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  /** 'platform' = Control-Plane operator (separate PlatformAdmin table); 'tenant' = company user. */
  kind: 'tenant' | 'platform';
  /** Tenant (company) this user belongs to. null = platform-level operator. */
  tenantId: string | null;
  roles: string[];
  permissions: string[];
  /**
   * Allowed org-unit ids for row-level scoping.
   * null  => global access (sees all rows, e.g. SUPER_ADMIN / ASSET_MANAGER)
   * []    => no org scope granted (sees nothing org-bound)
   * [ids] => limited to these units (and their descendants, pre-expanded)
   */
  scopeOrgUnitIds: string[] | null;
}
