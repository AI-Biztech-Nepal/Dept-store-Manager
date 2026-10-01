// lib/components/finance/InventoryScreen.tsx
import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, Modal, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../hooks/useAuth';
import { useSupabaseQuery, useSupabaseInsert, useSupabaseUpdate, useSupabaseDelete } from '../../hooks/useSupabase';
import { showAlert, getErrorMessage } from '../../utils/alert';
import type { Product } from '../../../types/database.types';

interface InventoryRow {
  key: string;
  name: string;
  price: number | null;
  stockLevel: number | null; // null = only ever typed into a bill, so no tracked stock level
  sold: number;
  purchased: number;
  product?: Product;
}

interface FormState {
  name: string;
  sku: string;
  barcode: string;
  category: string;
  unit: string;
  price: string;
  purchase_price: string;
  stock_level: string;
  reorder_level: string;
}

const EMPTY_FORM: FormState = {
  name: '', sku: '', barcode: '', category: '', unit: 'pcs', price: '', purchase_price: '', stock_level: '', reorder_level: '',
};

function formFromProduct(p: Product): FormState {
  return {
    name: p.name,
    sku: p.sku ?? '',
    barcode: p.barcode ?? '',
    category: p.category ?? '',
    unit: p.unit,
    price: String(p.price),
    purchase_price: p.purchase_price != null ? String(p.purchase_price) : '',
    stock_level: String(p.stock_level),
    reorder_level: String(p.reorder_level),
  };
}

function Field({ label, value, onChange, keyboardType }: { label: string; value: string; onChange: (v: string) => void; keyboardType?: 'numeric' }) {
  return (
    <View className="mb-3">
      <Text className="mb-1 text-xs font-semibold text-gray-500">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        placeholderTextColor="#9CA3AF"
        className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900"
      />
    </View>
  );
}

/** The shelf: each product's live stock next to how many units have moved
 * through Sale and Purchase bills. Stock itself is moved by a database
 * trigger when a bill is saved, edited or deleted (0002_profiles_inventory
 * .sql) - bills match products by item name. Items that only ever exist as
 * a typed bill line (finance_items) are listed too, without a stock level. */
export function InventoryScreen() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const { data: products } = useSupabaseQuery('products', {
    filters: userId ? { owner_id: userId } : {},
    orderBy: { column: 'name' },
    enabled: !!userId,
  });
  const { data: financeItems } = useSupabaseQuery('finance_items', {
    filters: userId ? { owner_id: userId } : {},
    enabled: !!userId,
  });
  const { data: transactions } = useSupabaseQuery('business_transactions', {
    filters: userId ? { owner_id: userId } : {},
    enabled: !!userId,
  });
  const createProduct = useSupabaseInsert('products');
  const updateProduct = useSupabaseUpdate('products');
  const deleteProduct = useSupabaseDelete('products');

  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [editing, setEditing] = useState<{ id: string | null; form: FormState } | null>(null);

  const rows = useMemo((): InventoryRow[] => {
    const soldByName = new Map<string, number>();
    const purchasedByName = new Map<string, number>();
    for (const t of transactions ?? []) {
      if (t.type !== 'sale' && t.type !== 'purchase') continue;
      const target = t.type === 'sale' ? soldByName : purchasedByName;
      for (const item of t.items) {
        const key = item.description.trim().toLowerCase();
        target.set(key, (target.get(key) ?? 0) + item.qty);
      }
    }

    const seenNames = new Set<string>();
    const productRows: InventoryRow[] = (products ?? []).map((product) => {
      const key = product.name.trim().toLowerCase();
      seenNames.add(key);
      return {
        key: `p-${product.id}`,
        name: product.name,
        price: Number(product.price),
        stockLevel: Number(product.stock_level),
        sold: soldByName.get(key) ?? 0,
        purchased: purchasedByName.get(key) ?? 0,
        product,
      };
    });

    // A typed item never used in a bill isn't real inventory yet.
    const financeItemRows = (financeItems ?? [])
      .filter((item) => !seenNames.has(item.name.trim().toLowerCase()))
      .map((item): InventoryRow | null => {
        const key = item.name.trim().toLowerCase();
        const sold = soldByName.get(key) ?? 0;
        const purchased = purchasedByName.get(key) ?? 0;
        if (sold === 0 && purchased === 0) return null;
        return { key: `f-${item.id}`, name: item.name, price: item.rate, stockLevel: null, sold, purchased };
      })
      .filter((r): r is InventoryRow => r !== null);

    return [...productRows, ...financeItemRows].sort((a, b) => a.name.localeCompare(b.name));
  }, [products, financeItems, transactions]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (lowOnly && !(r.product && r.stockLevel! <= Number(r.product.reorder_level))) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.product?.sku ?? '').toLowerCase().includes(q) ||
        (r.product?.barcode ?? '').includes(q)
      );
    });
  }, [rows, search, lowOnly]);

  const stockValue = useMemo(
    () => (products ?? []).reduce((sum, p) => sum + Number(p.stock_level) * Number(p.purchase_price ?? 0), 0),
    [products]
  );
  const lowCount = useMemo(
    () => (products ?? []).filter((p) => Number(p.stock_level) <= Number(p.reorder_level)).length,
    [products]
  );

  async function save() {
    if (!editing || !userId) return;
    const f = editing.form;
    if (!f.name.trim()) {
      showAlert('Add a name', 'Enter the product name.');
      return;
    }
    const values = {
      name: f.name.trim(),
      sku: f.sku.trim() || null,
      barcode: f.barcode.trim() || null,
      category: f.category.trim() || null,
      unit: f.unit.trim() || 'pcs',
      price: Number(f.price) || 0,
      purchase_price: f.purchase_price.trim() ? Number(f.purchase_price) : null,
      stock_level: Number(f.stock_level) || 0,
      reorder_level: Number(f.reorder_level) || 0,
    };
    try {
      if (editing.id) await updateProduct.mutateAsync({ id: editing.id, values });
      else await createProduct.mutateAsync({ owner_id: userId, ...values });
      setEditing(null);
    } catch (err) {
      const msg = getErrorMessage(err);
      showAlert('Could not save', /duplicate key/i.test(msg) ? 'A product with this name or barcode already exists.' : msg);
    }
  }

  function confirmDelete(p: Product) {
    showAlert('Delete product?', `${p.name} will be removed from inventory. Past bills are not affected.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProduct.mutateAsync(p.id);
            setEditing(null);
          } catch (err) {
            showAlert('Could not delete', getErrorMessage(err));
          }
        },
      },
    ]);
  }

  const set = (k: keyof FormState) => (v: string) => setEditing((e) => (e ? { ...e, form: { ...e.form, [k]: v } } : e));

  return (
    <View className="flex-1 bg-gray-50 px-6 pt-4">
      <View className="mb-3 flex-row items-center gap-2">
        <Pressable onPress={() => router.back()} hitSlop={8} className="p-1">
          <Ionicons name="chevron-back" size={20} color="#374151" />
        </Pressable>
        <Text className="flex-1 text-base font-bold text-gray-900">Inventory</Text>
        <Pressable
          onPress={() => setEditing({ id: null, form: EMPTY_FORM })}
          className="flex-row items-center gap-1 rounded-full bg-blue-600 px-3.5 py-2"
        >
          <Ionicons name="add" size={16} color="white" />
          <Text className="text-xs font-bold text-white">Add product</Text>
        </Pressable>
      </View>

      <View className="mb-3 flex-row gap-2">
        <View className="flex-1 rounded-xl bg-white p-3">
          <Text className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Stock value (cost)</Text>
          <Text className="mt-0.5 text-sm font-extrabold text-gray-900">NPR {Math.round(stockValue).toLocaleString()}</Text>
        </View>
        <Pressable onPress={() => setLowOnly((v) => !v)} className={`flex-1 rounded-xl p-3 ${lowOnly ? 'bg-red-100' : 'bg-white'}`}>
          <Text className="text-[10px] font-semibold uppercase tracking-wide text-red-500">Low / out of stock</Text>
          <Text className="mt-0.5 text-sm font-extrabold text-red-600">{lowCount}</Text>
        </Pressable>
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search name, SKU or barcode"
        placeholderTextColor="#9CA3AF"
        className="mb-3 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900"
      />

      <FlatList
        data={filteredRows}
        keyExtractor={(r) => r.key}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item: r }) => (
          <Pressable
            disabled={!r.product}
            onPress={() => r.product && setEditing({ id: r.product.id, form: formFromProduct(r.product) })}
            className="mb-2.5 rounded-2xl border border-gray-200 bg-white p-4"
          >
            <View className="mb-2 flex-row items-center justify-between">
              <View className="flex-1 pr-2">
                <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>{r.name}</Text>
                {!!r.product?.category && <Text className="text-[11px] text-gray-400">{r.product.category}</Text>}
              </View>
              {r.price != null && <Text className="text-sm font-extrabold text-gray-900">NPR {r.price.toLocaleString()}</Text>}
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1 rounded-lg bg-gray-50 p-2.5">
                <Text className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">In Stock</Text>
                {r.stockLevel != null ? (
                  <Text className={`mt-0.5 text-sm font-bold ${r.stockLevel > Number(r.product?.reorder_level ?? 0) ? 'text-gray-900' : 'text-red-500'}`}>
                    {r.stockLevel} {r.product?.unit}
                  </Text>
                ) : (
                  <Text className="mt-0.5 text-sm font-bold text-gray-300">—</Text>
                )}
              </View>
              <View className="flex-1 rounded-lg bg-emerald-50 p-2.5">
                <Text className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Sold</Text>
                <Text className="mt-0.5 text-sm font-bold text-emerald-700">{r.sold}</Text>
              </View>
              <View className="flex-1 rounded-lg bg-blue-50 p-2.5">
                <Text className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">Purchased</Text>
                <Text className="mt-0.5 text-sm font-bold text-blue-700">{r.purchased}</Text>
              </View>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View className="items-center rounded-2xl border border-dashed border-gray-200 bg-white py-10">
            <Ionicons name="cube-outline" size={28} color="#D1D5DB" />
            <Text className="mt-2 text-gray-500">{rows.length > 0 ? 'No matches.' : 'No products yet. Tap Add product.'}</Text>
          </View>
        }
      />

      <Modal visible={!!editing} animationType="slide" onRequestClose={() => setEditing(null)}>
        <View className="flex-1 bg-gray-50 px-6 pt-12">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-bold text-gray-900">{editing?.id ? 'Edit product' : 'New product'}</Text>
            <Pressable onPress={() => setEditing(null)} hitSlop={8}>
              <Ionicons name="close" size={24} color="#374151" />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
            {editing && (
              <>
                <Field label="Name" value={editing.form.name} onChange={set('name')} />
                <View className="flex-row gap-3">
                  <View className="flex-1"><Field label="SKU" value={editing.form.sku} onChange={set('sku')} /></View>
                  <View className="flex-1"><Field label="Barcode" value={editing.form.barcode} onChange={set('barcode')} /></View>
                </View>
                <View className="flex-row gap-3">
                  <View className="flex-1"><Field label="Category" value={editing.form.category} onChange={set('category')} /></View>
                  <View className="flex-1"><Field label="Unit" value={editing.form.unit} onChange={set('unit')} /></View>
                </View>
                <View className="flex-row gap-3">
                  <View className="flex-1"><Field label="Selling price" value={editing.form.price} onChange={set('price')} keyboardType="numeric" /></View>
                  <View className="flex-1"><Field label="Cost price" value={editing.form.purchase_price} onChange={set('purchase_price')} keyboardType="numeric" /></View>
                </View>
                <View className="flex-row gap-3">
                  <View className="flex-1"><Field label={editing.id ? 'In stock' : 'Opening stock'} value={editing.form.stock_level} onChange={set('stock_level')} keyboardType="numeric" /></View>
                  <View className="flex-1"><Field label="Reorder level" value={editing.form.reorder_level} onChange={set('reorder_level')} keyboardType="numeric" /></View>
                </View>
                <Pressable
                  onPress={save}
                  disabled={createProduct.isPending || updateProduct.isPending}
                  className="mt-2 items-center rounded-xl bg-blue-600 py-3.5 disabled:opacity-50"
                >
                  <Text className="text-[15px] font-bold text-white">Save</Text>
                </Pressable>
                {!!editing.id && (
                  <Pressable
                    onPress={() => confirmDelete((products ?? []).find((p) => p.id === editing.id)!)}
                    className="mt-3 items-center rounded-xl border border-red-200 py-3.5"
                  >
                    <Text className="text-[15px] font-bold text-red-600">Delete product</Text>
                  </Pressable>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
