// lib/components/finance/InventoryScreen.tsx
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { View, Text, TextInput, Pressable, Modal, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../hooks/useAuth';
import { useSupabaseQuery, useSupabaseInsert, useSupabaseUpdate, useSupabaseDelete } from '../../hooks/useSupabase';
import { showAlert, getErrorMessage } from '../../utils/alert';
import { BackButton, BookPage, BookStat, BookStats, BookTable, FilterTabs, Pill, ToolbarButton, ToolbarSearch, money, useBookLayout, useBookToolbar, type BookColumn } from './BookKit';
import { ConfirmSaveCard, type ConfirmSaveOptions } from './ConfirmSave';
import type { Product } from '../../../types/database.types';

type StockStatus = 'ok' | 'low' | 'out' | 'untracked';
type StatusFilter = 'all' | 'low' | 'out';

const STATUS = {
  ok: { label: 'In stock', color: '#047857', bg: '#ECFDF5' },
  low: { label: 'Low', color: '#B45309', bg: '#FFFBEB' },
  out: { label: 'Out', color: '#B91C1C', bg: '#FEF2F2' },
  untracked: { label: 'Bills only', color: '#4B5563', bg: '#F3F4F6' },
} satisfies Record<StockStatus, { label: string; color: string; bg: string }>;

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'low', label: 'Low' },
  { key: 'out', label: 'Out' },
];

interface InventoryRow {
  key: string;
  name: string;
  category: string | null;
  sku: string | null;
  unit: string | null;
  price: number | null;
  cost: number | null;
  stockLevel: number | null; // null = only ever typed into a bill, so no tracked stock level
  reorderLevel: number | null;
  sold: number;
  purchased: number;
  status: StockStatus;
  /** Stock on hand at cost price; null when there's no stock level or no cost. */
  value: number | null;
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

// The form's field order - down the rows, left to right - which is also the
// order Enter walks through them (the last one saves).
const FORM_ROWS: (keyof FormState)[][] = [
  ['name'],
  ['sku', 'barcode'],
  ['category', 'unit'],
  ['price', 'purchase_price'],
  ['stock_level', 'reorder_level'],
];
const FORM_ORDER = FORM_ROWS.flat();
const NUMERIC_FIELDS = new Set<keyof FormState>(['price', 'purchase_price', 'stock_level', 'reorder_level']);

/** What a save writes to `products` (the form's text, parsed). */
interface ProductValues {
  name: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  unit: string;
  price: number;
  purchase_price: number | null;
  stock_level: number;
  reorder_level: number;
}

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

function statusOf(p: Product): StockStatus {
  const stock = Number(p.stock_level);
  if (stock <= 0) return 'out';
  return stock <= Number(p.reorder_level) ? 'low' : 'ok';
}

/** Quantities and prices keep their decimals (2.5 kg, Rs 12.50); `money` would round. */
const qty = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 3 });
const rs = (n: number | null) => (n == null ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: 2 }));

function Field({
  label,
  value,
  onChange,
  numeric,
  inputRef,
  onSubmit,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
  inputRef: (el: TextInput | null) => void;
  onSubmit: () => void;
  autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View className="mb-3 flex-1">
      <Text className="mb-1 text-xs font-semibold text-gray-500">{label}</Text>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? 'numeric' : undefined}
        onSubmitEditing={onSubmit}
        blurOnSubmit={false}
        selectTextOnFocus
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor="#9CA3AF"
        className="rounded-lg border bg-white px-3 py-2.5 text-sm text-gray-900"
        style={[{ borderColor: focused ? '#2563EB' : '#D1D5DB' }, { outlineStyle: 'none' } as object]}
      />
    </View>
  );
}

/** The shelf: each product's live stock next to how many units have moved
 * through Sale and Purchase bills, laid out as the same cash-book table the
 * Transactions page uses. Stock itself is moved by a database trigger when a
 * bill is saved, edited or deleted (0002_profiles_inventory.sql) - bills match
 * products by item name. Items that only ever exist as a typed bill line
 * (finance_items) are listed too, without a stock level. */
export function InventoryScreen() {
  const layout = useBookLayout();
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
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [editing, setEditing] = useState<{ id: string | null; form: FormState } | null>(null);
  // "Save this product?" is asked inside the dialog itself (not as a second
  // modal), holding the values it will save if confirmed.
  const [confirming, setConfirming] = useState<{ options: ConfirmSaveOptions; values: ProductValues } | null>(null);
  const inputs = useRef<(TextInput | null)[]>([]);

  // Search, the All / Low / Out filter and Add product live in the top bar on a
  // wide screen (a plain row above the tiles on a phone).
  const toolbar = useBookToolbar(
    {
      wide: layout.wide,
      left: layout.wide ? undefined : () => <BackButton onPress={() => router.back()} />,
      right: (inBar) => (
        <>
          <ToolbarSearch value={search} onChange={setSearch} placeholder="Search name, SKU or barcode" wide={inBar} />
          <FilterTabs options={FILTERS} value={filter} onChange={setFilter} />
          <ToolbarButton icon="add" label="Add product" onPress={() => setEditing({ id: null, form: EMPTY_FORM })} />
        </>
      ),
    },
    [search, filter]
  );

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
      const stock = Number(product.stock_level);
      const cost = product.purchase_price != null ? Number(product.purchase_price) : null;
      return {
        key: `p-${product.id}`,
        name: product.name,
        category: product.category,
        sku: product.sku,
        unit: product.unit,
        price: Number(product.price),
        cost,
        stockLevel: stock,
        reorderLevel: Number(product.reorder_level),
        sold: soldByName.get(key) ?? 0,
        purchased: purchasedByName.get(key) ?? 0,
        status: statusOf(product),
        value: cost != null ? stock * cost : null,
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
        return {
          key: `f-${item.id}`,
          name: item.name,
          category: null,
          sku: null,
          unit: null,
          price: item.rate,
          cost: null,
          stockLevel: null,
          reorderLevel: null,
          sold,
          purchased,
          status: 'untracked',
          value: null,
        };
      })
      .filter((r): r is InventoryRow => r !== null);

    return [...productRows, ...financeItemRows].sort((a, b) => a.name.localeCompare(b.name));
  }, [products, financeItems, transactions]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== 'all' && r.status !== filter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.category ?? '').toLowerCase().includes(q) ||
        (r.sku ?? '').toLowerCase().includes(q) ||
        (r.product?.barcode ?? '').includes(q)
      );
    });
  }, [rows, search, filter]);

  const stats = useMemo(() => {
    let value = 0;
    let low = 0;
    let out = 0;
    for (const r of rows) {
      value += r.value ?? 0;
      if (r.status === 'low') low += 1;
      if (r.status === 'out') out += 1;
    }
    return { products: (products ?? []).length, value, low, out };
  }, [rows, products]);

  const totals = useMemo(
    () => ({
      sold: filteredRows.reduce((s, r) => s + r.sold, 0),
      purchased: filteredRows.reduce((s, r) => s + r.purchased, 0),
      value: filteredRows.reduce((s, r) => s + (r.value ?? 0), 0),
    }),
    [filteredRows]
  );

  // Step one of saving: check the form, then ask. Nothing is written yet.
  function save() {
    if (!editing || !userId || confirming) return;
    const f = editing.form;
    if (!f.name.trim()) {
      showAlert('Add a name', 'Enter the product name.');
      return;
    }
    const values: ProductValues = {
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
    setConfirming({
      values,
      options: {
        title: editing.id ? 'Save changes to this product?' : 'Add this product?',
        rows: [
          { label: 'Product', value: values.name },
          { label: editing.id ? 'In stock' : 'Opening stock', value: `${qty(values.stock_level)} ${values.unit}` },
          { label: 'Selling price', value: `NPR ${rs(values.price)}` },
          ...(values.purchase_price != null ? [{ label: 'Cost price', value: `NPR ${rs(values.purchase_price)}` }] : []),
        ],
      },
    });
  }

  // Step two, after "Yes, save".
  async function commitSave() {
    if (!editing || !userId || !confirming) return;
    if (createProduct.isPending || updateProduct.isPending) return;
    const { values } = confirming;
    try {
      if (editing.id) await updateProduct.mutateAsync({ id: editing.id, values });
      else await createProduct.mutateAsync({ owner_id: userId, ...values });
      setConfirming(null);
      setEditing(null);
    } catch (err) {
      setConfirming(null);
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

  const openEdit = (r: InventoryRow) => {
    if (r.product) setEditing({ id: r.product.id, form: formFromProduct(r.product) });
  };
  const closeDialog = () => {
    setConfirming(null);
    setEditing(null);
  };
  // Esc / "No" on the question goes back to the form with the caret on the
  // last field, rather than throwing away what was typed.
  const backToForm = () => {
    setConfirming(null);
    setTimeout(() => inputs.current[FORM_ORDER.length - 1]?.focus(), 0);
  };
  const set = (k: keyof FormState) => (v: string) => setEditing((e) => (e ? { ...e, form: { ...e.form, [k]: v } } : e));

  const num = (text: string, color = '#374151', bold = false) => (
    <Text className={`text-[12.5px] ${bold ? 'font-bold' : 'font-medium'}`} style={{ color }} numberOfLines={1}>
      {text}
    </Text>
  );
  const dash = <Text className="text-[12.5px] text-gray-400">—</Text>;

  const trash = (r: InventoryRow) =>
    r.product ? (
      <Pressable onPress={() => confirmDelete(r.product!)} hitSlop={6} accessibilityLabel="Delete product" className="opacity-50">
        <Ionicons name="trash-outline" size={15} color="#6B7280" />
      </Pressable>
    ) : null;

  const stockText = (r: InventoryRow) => (r.stockLevel == null ? null : `${qty(r.stockLevel)}${r.unit ? ` ${r.unit}` : ''}`);
  const stockColor = (r: InventoryRow) => (r.status === 'out' ? '#B91C1C' : r.status === 'low' ? '#B45309' : '#111827');
  const subline = (r: InventoryRow) => [r.category, r.sku ? `SKU ${r.sku}` : null].filter(Boolean).join(' · ');

  const itemCell = (r: InventoryRow, compact: boolean) => (
    <View style={{ minWidth: 0, gap: 2 }}>
      <Text className="text-[13px] font-medium text-gray-900" numberOfLines={1}>
        {r.name}
      </Text>
      {compact && <Pill text={STATUS[r.status].label} color={STATUS[r.status].color} bg={STATUS[r.status].bg} />}
      {!!subline(r) && (
        <Text className="text-[11px] text-gray-400" numberOfLines={1}>
          {subline(r)}
        </Text>
      )}
      {compact && (
        <Text className="text-[11px] text-gray-400" numberOfLines={1}>
          Sold {qty(r.sold)} · Bought {qty(r.purchased)}
        </Text>
      )}
    </View>
  );

  const columns: BookColumn<InventoryRow>[] = layout.full
    ? [
        { key: 'item', label: 'Item', render: (r) => itemCell(r, false) },
        { key: 'stock', label: 'In stock', width: 96, align: 'right', render: (r) => (stockText(r) ? num(stockText(r)!, stockColor(r), true) : dash) },
        { key: 'status', label: 'Status', width: 90, render: (r) => <Pill text={STATUS[r.status].label} color={STATUS[r.status].color} bg={STATUS[r.status].bg} /> },
        { key: 'reorder', label: 'Reorder at', width: 84, align: 'right', render: (r) => (r.reorderLevel != null ? num(qty(r.reorderLevel), '#4B5563') : dash) },
        { key: 'cost', label: 'Cost price', width: 90, align: 'right', render: (r) => (r.cost != null ? num(rs(r.cost), '#4B5563') : dash) },
        { key: 'price', label: 'Selling price', width: 100, align: 'right', render: (r) => (r.price != null ? num(rs(r.price)) : dash) },
        { key: 'sold', label: 'Sold', width: 72, align: 'right', render: (r) => num(qty(r.sold), '#047857', true) },
        { key: 'purchased', label: 'Purchased', width: 92, align: 'right', render: (r) => num(qty(r.purchased), '#1D4ED8', true) },
        { key: 'value', label: 'Stock value', width: 108, align: 'right', render: (r) => (r.value != null ? num(money(r.value)) : dash) },
        { key: 'act', label: '', width: 40, align: 'right', render: trash },
      ]
    : [
        { key: 'item', label: 'Item', render: (r) => itemCell(r, true) },
        { key: 'stock', label: 'In stock', width: 84, align: 'right', render: (r) => (stockText(r) ? num(stockText(r)!, stockColor(r), true) : dash) },
        { key: 'price', label: 'Price', width: 80, align: 'right', render: (r) => (r.price != null ? num(rs(r.price)) : dash) },
        { key: 'act', label: '', width: 34, align: 'right', render: trash },
      ];

  const footer = layout.full
    ? {
        label: `${filteredRows.length} ${filteredRows.length === 1 ? 'item' : 'items'} · Totals`,
        cells: {
          sold: <Text className="text-[13px] font-extrabold" style={{ color: '#047857' }}>{qty(totals.sold)}</Text>,
          purchased: <Text className="text-[13px] font-extrabold" style={{ color: '#1D4ED8' }}>{qty(totals.purchased)}</Text>,
          value: <Text className="text-[13px] font-extrabold text-gray-900">{money(totals.value)}</Text>,
        },
      }
    : undefined;

  const toggleFilter = (key: Exclude<StatusFilter, 'all'>) => setFilter((f) => (f === key ? 'all' : key));
  const dialogMode = layout.wide;

  const fieldLabel = (key: keyof FormState): string => {
    switch (key) {
      case 'name': return 'Name';
      case 'sku': return 'SKU';
      case 'barcode': return 'Barcode';
      case 'category': return 'Category';
      case 'unit': return 'Unit';
      case 'price': return 'Selling price';
      case 'purchase_price': return 'Cost price';
      case 'stock_level': return editing?.id ? 'In stock' : 'Opening stock';
      case 'reorder_level': return 'Reorder level';
    }
  };

  const formFields = editing
    ? FORM_ROWS.map((fields) => (
        <View key={fields.join('-')} className="flex-row" style={{ gap: 12 }}>
          {fields.map((key) => {
            const index = FORM_ORDER.indexOf(key);
            return (
              <Field
                key={key}
                label={fieldLabel(key)}
                value={editing.form[key]}
                onChange={set(key)}
                numeric={NUMERIC_FIELDS.has(key)}
                inputRef={(el) => {
                  inputs.current[index] = el;
                }}
                onSubmit={() => (index < FORM_ORDER.length - 1 ? inputs.current[index + 1]?.focus() : void save())}
                autoFocus={dialogMode && index === 0}
              />
            );
          })}
        </View>
      ))
    : null;

  const saving = createProduct.isPending || updateProduct.isPending;
  const deletable = editing?.id ? (products ?? []).find((p) => p.id === editing.id) : undefined;

  // While the "save this?" question is up the form is only hidden, not
  // unmounted, so everything typed (and the caret's place) survives a "No".
  const dialogBody: ReactNode = editing && (
    <>
      {confirming && <ConfirmSaveCard options={confirming.options} onConfirm={commitSave} onCancel={backToForm} />}
      <View style={confirming ? { display: 'none' } : undefined}>
        <View className="mb-4 flex-row items-center justify-between">
          <Text className={dialogMode ? 'text-lg font-extrabold text-gray-900' : 'text-lg font-bold text-gray-900'}>
            {editing.id ? 'Edit product' : 'New product'}
          </Text>
          <Pressable onPress={closeDialog} hitSlop={8} accessibilityLabel="Close">
            <Ionicons name="close" size={24} color="#374151" />
          </Pressable>
        </View>
        {formFields}
        {dialogMode ? (
          <View className="mt-2 flex-row items-center" style={{ gap: 10 }}>
            {deletable && (
              <Pressable onPress={() => confirmDelete(deletable)} className="rounded-xl border border-red-200 px-4 py-3">
                <Text className="text-sm font-bold text-red-600">Delete</Text>
              </Pressable>
            )}
            <View className="flex-1" />
            <Pressable onPress={closeDialog} className="rounded-xl border border-gray-300 bg-white px-5 py-3">
              <Text className="text-sm font-bold text-gray-600">Cancel</Text>
            </Pressable>
            <Pressable onPress={save} disabled={saving} className="rounded-xl px-6 py-3 disabled:opacity-50" style={{ backgroundColor: '#1D4ED8' }}>
              <Text className="text-sm font-bold text-white">Save</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Pressable onPress={save} disabled={saving} className="mt-2 items-center rounded-xl bg-blue-600 py-3.5 disabled:opacity-50">
              <Text className="text-[15px] font-bold text-white">Save</Text>
            </Pressable>
            {deletable && (
              <Pressable onPress={() => confirmDelete(deletable)} className="mt-3 items-center rounded-xl border border-red-200 py-3.5">
                <Text className="text-[15px] font-bold text-red-600">Delete product</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </>
  );

  return (
    <BookPage wide={layout.wide}>
      {toolbar}

      <BookStats>
        <BookStat label="Products" value={String(stats.products)} color="#374151" />
        <BookStat label="Stock value (cost)" value={`NPR ${money(stats.value)}`} color="#1D4ED8" />
        <BookStat label="Low stock" value={String(stats.low)} color="#B45309" onPress={() => toggleFilter('low')} />
        <BookStat label="Out of stock" value={String(stats.out)} color="#B91C1C" onPress={() => toggleFilter('out')} />
      </BookStats>

      {filteredRows.length === 0 ? (
        <View className="items-center rounded-xl border border-gray-300 bg-white py-10">
          <Ionicons name="cube-outline" size={28} color="#D1D5DB" />
          <Text className="mt-2 text-gray-500">{rows.length > 0 ? 'No matches.' : 'No products yet. Tap Add product.'}</Text>
        </View>
      ) : (
        <BookTable columns={columns} rows={filteredRows} rowKey={(r) => r.key} onRowPress={openEdit} footer={footer} />
      )}

      <Text className="px-1 text-[11.5px] leading-[17px] text-gray-400">
        Tap a product to edit it. Stock goes down when a sale is saved and up when a purchase is saved - bills match products by item name. Items marked
        "Bills only" were typed into a bill but are not tracked products yet.
      </Text>

      <Modal
        visible={!!editing}
        transparent={dialogMode}
        animationType={dialogMode ? 'fade' : 'slide'}
        onRequestClose={confirming ? backToForm : closeDialog}
      >
        {dialogMode ? (
          <View className="flex-1 items-center justify-center bg-black/40 px-6">
            <View
              className="w-full rounded-2xl bg-white"
              style={{ maxWidth: 560, padding: 24, boxShadow: '0 20px 50px rgba(16,24,40,0.25)' }}
            >
              {dialogBody}
            </View>
          </View>
        ) : (
          <View className="flex-1 bg-gray-50 px-6 pt-12">
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
              {dialogBody}
            </ScrollView>
          </View>
        )}
      </Modal>
    </BookPage>
  );
}
