// app/(store)/_layout.tsx
import { Platform, useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { RoleGuard } from '../../lib/components/RoleGuard';
import { TabIcon } from '../../lib/components/TabIcon';
import { PortalHeaderBar } from '../../lib/components/PortalHeaderBar';
import { ROLE_ACCENT } from '../../lib/constants/roleColors';
import { WebSidebarShell, WEB_SIDEBAR_MIN_WIDTH, type WebNavItem } from '../../lib/components/web/WebSidebarShell';
import { shortcuts as financeShortcuts } from '../../lib/components/finance/FinanceDashboardScreen';

// On web the sections sit in a persistent left rail (see WebSidebarShell),
// reusing the Finance dashboard's own shortcut list so the two never drift.
const NAV_ITEMS: WebNavItem[] = [
  {
    href: '/(store)/finance',
    label: 'Dashboard',
    icon: 'wallet',
    children: financeShortcuts('/(store)').map((s) => ({ href: s.href, label: s.label, icon: s.icon })),
  },
];

const HIDDEN: [string, string][] = [
  ['customers', 'Ledger'],
  ['customer/[id]', 'Customer'],
  ['transactions', 'Statement'],
  ['quick-payment', 'Quick Payment'],
  ['received', 'Total Received'],
  ['paid', 'Total Paid'],
  ['to-receive', 'Receivable'],
  ['to-give', 'Payable'],
  ['bank-accounts', 'Bank Accounts'],
  ['bank-balances', 'Available Balance'],
  ['import-statement', 'Import Statement'],
  ['inventory', 'Inventory'],
  ['report', 'Report'],
  ['daybook', 'Day Book'],
  ['profile', 'Store Details'],
];

export default function StoreLayout() {
  const { width } = useWindowDimensions();
  const isWideWeb = Platform.OS === 'web' && width >= WEB_SIDEBAR_MIN_WIDTH;
  const tabs = (
    <Tabs
      backBehavior="history"
      screenOptions={{
        header: ({ options }) => (
          <PortalHeaderBar
            title={options.title}
            hideAccount={isWideWeb}
            left={options.headerLeft?.({ canGoBack: false })}
            right={options.headerRight?.({ canGoBack: false })}
          />
        ),
        tabBarActiveTintColor: ROLE_ACCENT.store,
        ...(isWideWeb ? { tabBarStyle: { display: 'none' } } : null),
      }}
    >
      <Tabs.Screen
        name="finance"
        options={{ title: 'Dashboard', tabBarIcon: ({ color, focused }) => <TabIcon name="wallet" color={color} focused={focused} /> }}
      />
      <Tabs.Screen
        name="inventory"
        options={{ title: 'Inventory', tabBarIcon: ({ color, focused }) => <TabIcon name="grid" color={color} focused={focused} /> }}
      />
      {HIDDEN.filter(([name]) => name !== 'inventory').map(([name, title]) => (
        <Tabs.Screen key={name} name={name} options={{ href: null, title }} />
      ))}
    </Tabs>
  );

  return (
    <RoleGuard allow={['store']}>
      {isWideWeb ? (
        <WebSidebarShell items={NAV_ITEMS} roleLabel="Store" profileHref="/(store)/profile">
          {tabs}
        </WebSidebarShell>
      ) : (
        tabs
      )}
    </RoleGuard>
  );
}
