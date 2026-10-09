// app/(store)/purchase-report.tsx
import { TotalsReportScreen } from '../../lib/components/finance/TotalsReportScreen';

export default function StorePurchaseReport() {
  return <TotalsReportScreen kind="purchase" basePath="/(store)" />;
}
