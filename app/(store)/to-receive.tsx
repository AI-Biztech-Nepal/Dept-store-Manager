// app/(store)/to-receive.tsx
import { PartyBalancesScreen } from '../../lib/components/finance/PartyBalancesScreen';

export default function StoreToReceive() {
  return <PartyBalancesScreen basePath="/(store)" direction="receive" />;
}
