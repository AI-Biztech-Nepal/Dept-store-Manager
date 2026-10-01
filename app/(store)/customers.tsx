// app/(store)/customers.tsx
import { CustomersListScreen } from '../../lib/components/finance/CustomersListScreen';

export default function CustomersScreen() {
  return <CustomersListScreen basePath="/(store)" />;
}
