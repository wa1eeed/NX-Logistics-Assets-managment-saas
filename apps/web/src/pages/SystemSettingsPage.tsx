import { useState, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Factory, Tags, Boxes, FolderTree } from 'lucide-react';
import { LOOKUP_TYPES } from '@nx-lam/shared';
import { useAuth } from '../auth/AuthContext';
import { PageHeader } from '../components/PageHeader';
import { TabBar, type TabDef } from '../components/TabBar';
import { LookupTypeManager, AssetTypesManager } from './ReferenceListsPage';
import { ClassesSection, ModelsSection } from './CatalogPage';

const LOOKUP_ICON: Record<string, ComponentType<{ className?: string }>> = {
  REGION: MapPin,
  MANUFACTURER: Factory,
  ASSET_CATEGORY: Tags,
};

/**
 * Unified "System Settings". Each reference list (cities, brands, categories…) is its
 * own tab; **vehicle models live under the brands tab** (models are linked to a brand);
 * the catalog tab is the **asset classification** (classes) only.
 */
export function SystemSettingsPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { hasPermission } = useAuth();
  const canTypes = hasPermission('asset_types.read') || hasPermission('asset_types.manage');

  const tabs: TabDef[] = [
    ...LOOKUP_TYPES.map((lt) => {
      const Icon = LOOKUP_ICON[lt.key] ?? Tags;
      return { key: lt.key, label: <><Icon className="h-4 w-4" />{isAr ? lt.ar : lt.en}</> };
    }),
    ...(canTypes ? [{ key: 'classes', label: <><FolderTree className="h-4 w-4" />{t('system.tab_classes')}</> }] : []),
    ...(canTypes ? [{ key: 'assetTypes', label: <><Boxes className="h-4 w-4" />{t('system.tab_types')}</> }] : []),
  ];
  const [tab, setTab] = useState(tabs[0].key);
  const isLookup = LOOKUP_TYPES.some((lt) => lt.key === tab);

  return (
    <div>
      <PageHeader title={t('system.title')} subtitle={t('system.subtitle')} />
      <TabBar tabs={tabs} active={tab} onChange={setTab} />
      {isLookup && (
        <div className="space-y-6">
          <LookupTypeManager typeKey={tab} />
          {/* Vehicle models belong to brands — managed right under the manufacturers list. */}
          {tab === 'MANUFACTURER' && canTypes && <ModelsSection />}
        </div>
      )}
      {tab === 'assetTypes' && canTypes && <AssetTypesManager />}
      {tab === 'classes' && canTypes && <ClassesSection />}
    </div>
  );
}
