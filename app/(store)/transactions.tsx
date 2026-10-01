// app/(store)/transactions.tsx
import { TransactionsScreen } from '../../lib/components/finance/TransactionsScreen';

export default function TransactionsRoute() {
  return <TransactionsScreen basePath="/(store)" />;
}
