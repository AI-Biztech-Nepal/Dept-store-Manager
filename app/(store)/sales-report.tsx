// app/(store)/sales-report.tsx
import { TotalsReportScreen } from '../../lib/components/finance/TotalsReportScreen';

export default function StoreSalesReport() {
  return <TotalsReportScreen kind="sale" basePath="/(store)" />;
}
