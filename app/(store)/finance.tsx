// app/(store)/finance.tsx
import { FinanceDashboardScreen } from '../../lib/components/finance/FinanceDashboardScreen';

export default function FinanceScreen() {
  return <FinanceDashboardScreen basePath="/(store)" />;
}
