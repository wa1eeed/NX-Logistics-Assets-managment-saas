import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { PageLoader } from './components/PageLoader';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { LandingPage } from './pages/LandingPage';

// Route pages are code-split & lazy-loaded — the Suspense fallback (PageLoader,
// wired in Layout around <Outlet/>) shows on every navigation.
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const UsersPage = lazy(() => import('./pages/UsersPage').then((m) => ({ default: m.UsersPage })));
const RolesPage = lazy(() => import('./pages/RolesPage').then((m) => ({ default: m.RolesPage })));
const OrgUnitsPage = lazy(() => import('./pages/OrgUnitsPage').then((m) => ({ default: m.OrgUnitsPage })));
const AssetTypesPage = lazy(() => import('./pages/AssetTypesPage').then((m) => ({ default: m.AssetTypesPage })));
const SystemSettingsPage = lazy(() => import('./pages/SystemSettingsPage').then((m) => ({ default: m.SystemSettingsPage })));
const AssetsListPage = lazy(() => import('./pages/AssetsListPage').then((m) => ({ default: m.AssetsListPage })));
const AssetProfilePage = lazy(() => import('./pages/AssetProfilePage').then((m) => ({ default: m.AssetProfilePage })));
const RentalsPage = lazy(() => import('./pages/RentalsPage').then((m) => ({ default: m.RentalsPage })));
const CustodyPage = lazy(() => import('./pages/CustodyPage').then((m) => ({ default: m.CustodyPage })));
const MaintenanceListPage = lazy(() => import('./pages/MaintenanceListPage').then((m) => ({ default: m.MaintenanceListPage })));
const WorkOrderDetailPage = lazy(() => import('./pages/WorkOrderDetailPage').then((m) => ({ default: m.WorkOrderDetailPage })));
const FleetKpisPage = lazy(() => import('./pages/FleetKpisPage').then((m) => ({ default: m.FleetKpisPage })));
const DisposalPage = lazy(() => import('./pages/DisposalPage').then((m) => ({ default: m.DisposalPage })));
const AcquisitionPage = lazy(() => import('./pages/AcquisitionPage').then((m) => ({ default: m.AcquisitionPage })));
const DriversPage = lazy(() => import('./pages/DriversPage').then((m) => ({ default: m.DriversPage })));
const AlertsPage = lazy(() => import('./pages/AlertsPage').then((m) => ({ default: m.AlertsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const BillingPage = lazy(() => import('./pages/BillingPage').then((m) => ({ default: m.BillingPage })));
const BillingReturnPage = lazy(() => import('./pages/BillingReturnPage').then((m) => ({ default: m.BillingReturnPage })));
const PlatformPage = lazy(() => import('./pages/PlatformPage').then((m) => ({ default: m.PlatformPage })));
const CompliancePage = lazy(() => import('./pages/CompliancePage').then((m) => ({ default: m.CompliancePage })));
const TrackingMapPage = lazy(() => import('./pages/tracking/TrackingMapPage').then((m) => ({ default: m.TrackingMapPage })));
const TrackingDevicesPage = lazy(() => import('./pages/tracking/TrackingDevicesPage').then((m) => ({ default: m.TrackingDevicesPage })));
const TrackingGeofencesPage = lazy(() => import('./pages/tracking/TrackingGeofencesPage').then((m) => ({ default: m.TrackingGeofencesPage })));
const TrackingSubscriptionPage = lazy(() => import('./pages/tracking/TrackingSubscriptionPage').then((m) => ({ default: m.TrackingSubscriptionPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const AuditPage = lazy(() => import('./pages/AuditPage').then((m) => ({ default: m.AuditPage })));

function RequirePermission({ perm, children }: { perm: string; children: ReactNode }) {
  const { hasPermission } = useAuth();
  if (!hasPermission(perm)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, loading, hasPermission } = useAuth();

  if (loading) {
    return <PageLoader fullScreen />;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={hasPermission('platform.tenants.read') ? <Navigate to="/platform" replace /> : <DashboardPage />} />
        <Route path="platform" element={<RequirePermission perm="platform.tenants.read"><PlatformPage /></RequirePermission>} />
        <Route path="fleet-kpis" element={<RequirePermission perm="kpis.read"><FleetKpisPage /></RequirePermission>} />
        <Route path="users" element={<RequirePermission perm="users.read"><UsersPage /></RequirePermission>} />
        <Route path="roles" element={<RequirePermission perm="roles.read"><RolesPage /></RequirePermission>} />
        <Route path="assets" element={<RequirePermission perm="assets.read"><AssetsListPage /></RequirePermission>} />
        <Route path="assets/:id" element={<RequirePermission perm="assets.read"><AssetProfilePage /></RequirePermission>} />
        <Route path="rentals" element={<RequirePermission perm="rentals.read"><RentalsPage /></RequirePermission>} />
        <Route path="custody" element={<RequirePermission perm="rentals.read"><CustodyPage /></RequirePermission>} />
        <Route path="maintenance" element={<RequirePermission perm="maintenance.read"><MaintenanceListPage /></RequirePermission>} />
        <Route path="compliance" element={<RequirePermission perm="assets.read"><CompliancePage /></RequirePermission>} />
        <Route path="maintenance/:id" element={<RequirePermission perm="maintenance.read"><WorkOrderDetailPage /></RequirePermission>} />
        <Route path="disposal" element={<RequirePermission perm="sale.read"><DisposalPage /></RequirePermission>} />
        <Route path="acquisition" element={<RequirePermission perm="acquisition.read"><AcquisitionPage /></RequirePermission>} />
        <Route path="drivers" element={<RequirePermission perm="drivers.read"><DriversPage /></RequirePermission>} />
        <Route path="tracking" element={<RequirePermission perm="assets.read"><TrackingMapPage /></RequirePermission>} />
        <Route path="tracking/devices" element={<RequirePermission perm="assets.read"><TrackingDevicesPage /></RequirePermission>} />
        <Route path="tracking/geofences" element={<RequirePermission perm="assets.read"><TrackingGeofencesPage /></RequirePermission>} />
        <Route path="tracking/subscription" element={<RequirePermission perm="assets.read"><TrackingSubscriptionPage /></RequirePermission>} />
        <Route path="alerts" element={<RequirePermission perm="kpis.read"><AlertsPage /></RequirePermission>} />
        <Route path="org-units" element={<RequirePermission perm="org_units.read"><OrgUnitsPage /></RequirePermission>} />
        <Route path="asset-types" element={<RequirePermission perm="asset_types.manage"><AssetTypesPage /></RequirePermission>} />
        <Route path="system-settings" element={<RequirePermission perm="settings.read"><SystemSettingsPage /></RequirePermission>} />
        {/* legacy paths → unified System Settings */}
        <Route path="catalog" element={<Navigate to="/system-settings" replace />} />
        <Route path="reference-lists" element={<Navigate to="/system-settings" replace />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<RequirePermission perm="settings.read"><SettingsPage /></RequirePermission>} />
        <Route path="billing" element={<RequirePermission perm="billing.read"><BillingPage /></RequirePermission>} />
        <Route path="billing/return" element={<RequirePermission perm="billing.read"><BillingReturnPage /></RequirePermission>} />
        <Route path="audit" element={<RequirePermission perm="audit.read"><AuditPage /></RequirePermission>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
