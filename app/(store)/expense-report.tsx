// app/(store)/expense-report.tsx
import { TotalsReportScreen } from '../../lib/components/finance/TotalsReportScreen';

export default function StoreExpenseReport() {
  return <TotalsReportScreen kind="expense" basePath="/(store)" />;
}
