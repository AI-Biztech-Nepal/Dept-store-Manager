// app/(store)/to-give.tsx
import { PartyBalancesScreen } from '../../lib/components/finance/PartyBalancesScreen';

export default function StoreToGive() {
  return <PartyBalancesScreen basePath="/(store)" direction="give" />;
}
