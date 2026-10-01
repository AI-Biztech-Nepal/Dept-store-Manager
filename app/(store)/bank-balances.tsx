// app/(store)/bank-balances.tsx
import { BankBalancesScreen } from '../../lib/components/finance/BankBalancesScreen';

export default function StoreBankBalances() {
  return <BankBalancesScreen basePath="/(store)" />;
}
