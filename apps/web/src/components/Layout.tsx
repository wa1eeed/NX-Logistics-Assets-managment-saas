import { Fragment, Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Users, ShieldCheck, Network, Boxes,
  Settings, ScrollText, LogOut, ChevronDown, Truck, ClipboardList, PackageCheck, Wrench, Gauge,
  Banknote, Handshake, IdCard, Bell, Menu, Wallet, Building2, UserCircle, Satellite,
  Map as MapIcon, MapPin, Cpu, SlidersHorizontal,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useTenantBranding } from '../lib/branding';
import { BrandCredit } from './BrandCredit';
import { NotificationBell } from './NotificationBell';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { cn } from '../lib/utils';
import { PageTransition } from './effects/PageTransition';
import { PageLoader } from './PageLoader';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from './ui/dropdown-menu';

type NavSection = 'admin' | 'operations' | 'tracking' | 'reference';

interface NavItem {
  to: string;
  labelKey: string;
  icon: ComponentType<{ className?: string }>;
  permission?: string;
  /** Only for users bound to specific org units (e.g. project managers) — hidden for global-scope roles. */
  scopedOnly?: boolean;
  /** Exact-match active state — needed for parent routes that share a prefix with children (e.g. /tracking). */
  end?: boolean;
  section: NavSection;
}

const SECTIONS: { key: NavSection; labelKey: string }[] = [
  { key: 'admin', labelKey: 'nav.section_admin' },
  { key: 'operations', labelKey: 'nav.section_operations' },
  { key: 'tracking', labelKey: 'nav.section_tracking' },
  { key: 'reference', labelKey: 'nav.section_reference' },
];

const NAV: NavItem[] = [
  { to: '/platform', labelKey: 'nav.platform', icon: Building2, permission: 'platform.tenants.read', section: 'admin' },
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard, section: 'admin' },
  { to: '/fleet-kpis', labelKey: 'nav.fleetKpis', icon: Gauge, permission: 'kpis.read', section: 'admin' },
  { to: '/alerts', labelKey: 'nav.alerts', icon: Bell, permission: 'kpis.read', section: 'admin' },
  { to: '/users', labelKey: 'nav.users', icon: Users, permission: 'users.read', section: 'admin' },
  { to: '/roles', labelKey: 'nav.roles', icon: ShieldCheck, permission: 'roles.read', section: 'admin' },
  { to: '/audit', labelKey: 'nav.audit', icon: ScrollText, permission: 'audit.read', section: 'admin' },
  { to: '/billing', labelKey: 'nav.billing', icon: Wallet, permission: 'billing.read', section: 'admin' },
  { to: '/assets', labelKey: 'nav.assets', icon: Truck, permission: 'assets.read', section: 'operations' },
  { to: '/rentals', labelKey: 'nav.rentals', icon: ClipboardList, permission: 'rentals.read', section: 'operations' },
  { to: '/custody', labelKey: 'nav.custody', icon: PackageCheck, permission: 'rentals.read', scopedOnly: true, section: 'operations' },
  { to: '/maintenance', labelKey: 'nav.maintenance', icon: Wrench, permission: 'maintenance.read', section: 'operations' },
  { to: '/compliance', labelKey: 'nav.compliance', icon: ShieldCheck, permission: 'kpis.read', section: 'operations' },
  { to: '/disposal', labelKey: 'nav.disposal', icon: Banknote, permission: 'sale.read', section: 'operations' },
  { to: '/acquisition', labelKey: 'nav.acquisition', icon: Handshake, permission: 'acquisition.read', section: 'operations' },
  { to: '/drivers', labelKey: 'nav.drivers', icon: IdCard, permission: 'drivers.read', section: 'operations' },
  { to: '/tracking', labelKey: 'nav.trackingMap', icon: MapIcon, permission: 'assets.read', section: 'tracking', end: true },
  { to: '/tracking/devices', labelKey: 'nav.trackingDevices', icon: Cpu, permission: 'billing.manage', section: 'tracking' },
  { to: '/tracking/geofences', labelKey: 'nav.trackingGeofences', icon: MapPin, permission: 'assets.read', section: 'tracking' },
  { to: '/tracking/subscription', labelKey: 'nav.trackingSubscription', icon: Satellite, permission: 'billing.manage', section: 'tracking' },
  { to: '/org-units', labelKey: 'nav.orgUnits', icon: Network, permission: 'org_units.read', section: 'reference' },
  { to: '/asset-types', labelKey: 'nav.assetTypes', icon: Boxes, permission: 'asset_types.manage', section: 'reference' },
  { to: '/system-settings', labelKey: 'nav.systemSettings', icon: SlidersHorizontal, permission: 'settings.read', section: 'reference' },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings, permission: 'settings.read', section: 'reference' },
];

function NavRow({ item }: { item: NavItem }) {
  const { t } = useTranslation();
  return (
    <NavLink to={item.to} end={item.to === '/' || !!item.end}>
      {({ isActive }) => (
        <div
          className={cn(
            'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            isActive
              ? 'text-primary'
              : 'text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/60',
          )}
        >
          {isActive && (
            <motion.div
              layoutId="nav-active"
              className="absolute inset-0 rounded-lg bg-primary/10"
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            />
          )}
          <item.icon className="relative z-10 h-[18px] w-[18px] shrink-0" />
          <span className="relative z-10">{t(item.labelKey)}</span>
        </div>
      )}
    </NavLink>
  );
}

export function Layout() {
  const { t } = useTranslation();
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);

  // Close the mobile drawer on navigation.
  useEffect(() => setNavOpen(false), [location.pathname]);

  // Global-scope users (scopeOrgUnitIds === null: super admin, dispatch, asset manager)
  // don't have a personal "My Custody" — they track custody via Rentals → Contracts.
  const isScoped = Array.isArray(user?.scopeOrgUnitIds);
  // The platform operator works only in /platform — the tenant dashboard is meaningless for them.
  const isPlatformAdmin = hasPermission('platform.tenants.read');
  // "Assets" terminology only in the asset-management portal; other portals say "Vehicles & Equipment".
  const ownsAssets = hasPermission('assets.update') || hasPermission('sale.read');
  // Per-tenant branding (logo / name / accent colour). Platform operator has no tenant.
  const tenant = useTenantBranding(!!user && !isPlatformAdmin);
  const brandName = tenant?.branding.brandName || tenant?.name || t('app.name');
  const logoUrl = tenant?.branding.logoUrl ?? null;
  const visible = NAV.filter(
    (n) => (!n.permission || hasPermission(n.permission))
      && (!n.scopedOnly || isScoped)
      && !(n.to === '/' && isPlatformAdmin),
  ).map((n) => (n.to === '/assets' && !ownsAssets ? { ...n, labelKey: 'nav.vehiclesEquipment' } : n));
  const renderedSections = SECTIONS
    .map((s) => ({ ...s, items: visible.filter((n) => n.section === s.key) }))
    .filter((s) => s.items.length > 0);

  const currentTitle = (() => {
    const match = NAV.find((n) => n.to === location.pathname);
    return match ? t(match.labelKey) : t('app.name');
  })();

  const initials = (user?.fullName ?? '?')
    .split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="flex min-h-screen bg-background">
      {navOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setNavOpen(false)} />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 start-0 z-50 flex h-screen w-64 shrink-0 flex-col border-e border-border bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:sticky lg:top-0 lg:self-start',
          // Off-screen only below lg (mobile/tablet). At lg+ the sidebar is in-flow but
          // sticky (pinned to top, self-start so it doesn't flex-stretch) — only the
          // page content scrolls; the nav itself scrolls internally via its overflow-y-auto.
          navOpen ? 'translate-x-0' : 'max-lg:ltr:-translate-x-full max-lg:rtl:translate-x-full',
        )}
      >
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          {logoUrl ? (
            <img src={logoUrl} alt={brandName} className="h-9 w-9 shrink-0 rounded-xl object-contain" />
          ) : (
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-extrabold text-white shadow-glow">
              NX
            </div>
          )}
          <div>
            <div className="text-sm font-bold leading-tight">{brandName}</div>
            <div className="text-[11px] text-sidebar-muted">{t('app.tagline')}</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {renderedSections.map((s, i) => (
            <Fragment key={s.key}>
              <div className={cn('px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-sidebar-muted', i === 0 ? 'pt-2' : 'pt-4')}>
                {t(s.labelKey)}
              </div>
              {s.items.map((n) => <NavRow key={n.to} item={n} />)}
            </Fragment>
          ))}
        </nav>
        <div className="border-t border-border px-4 py-3">
          <BrandCredit />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-2 border-b bg-card/80 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              className="-ms-1 rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
              onClick={() => setNavOpen(true)}
              aria-label={t('nav.openMenu')}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="truncate text-[15px] font-semibold">{currentTitle}</div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <LanguageSwitcher />
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {initials}
                  </div>
                  <div className="hidden text-start leading-tight sm:block">
                    <div className="text-[13px] font-semibold">{user?.fullName}</div>
                    <div className="text-[11px] text-muted-foreground">{user?.roles.join(', ')}</div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <UserCircle className="h-4 w-4" />
                  {t('nav.profile')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout} className="text-destructive">
                  <LogOut className="h-4 w-4" />
                  {t('common.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <Suspense fallback={<PageLoader />}>
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
