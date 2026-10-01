// lib/components/finance/BookKit.tsx
//
// The cash-book look the Day Book established - a header card, a strip of
// stat tiles, one bordered table with a totals footer - as reusable pieces,
// so Ledger and Transactions read as the same family of pages.
import { type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { WEB_SIDEBAR_MIN_WIDTH } from '../web/WebSidebarShell';

/** Whole rupees with thousands separators; a dash for "nothing". */
export function money(n: number | null | undefined): string {
  return n == null ? '—' : Math.round(n).toLocaleString();
}

/** Same breakpoints the Day Book uses: `wide` once the sidebar layout is on,
 * `full` once every column fits beside it. */
export function useBookLayout(): { wide: boolean; full: boolean } {
  const { width } = useWindowDimensions();
  const wide = Platform.OS === 'web' && width >= WEB_SIDEBAR_MIN_WIDTH;
  return { wide, full: wide && width >= 1280 };
}

export function BookPage({ wide, children }: { wide: boolean; children: ReactNode }) {
  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ padding: wide ? 24 : 12, paddingTop: wide ? 24 : 12, paddingBottom: 48, gap: 14 }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function BookHeader({
  eyebrow,
  title,
  subtitle,
  left,
  right,
  wide,
}: {
  eyebrow?: string | null;
  title: string;
  subtitle?: string;
  /** Sits before the title (a back button). */
  left?: ReactNode;
  right?: ReactNode;
  wide: boolean;
}) {
  return (
    <View className="rounded-2xl border border-gray-200 bg-white px-4 py-3.5">
      <View className={wide ? 'flex-row items-center' : ''} style={{ gap: 12 }}>
        <View className={`flex-row items-center ${wide ? 'flex-1' : ''}`} style={{ gap: 10 }}>
          {left}
          <View className="flex-1">
            {!!eyebrow && <Text className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{eyebrow}</Text>}
            <Text className="text-[17px] font-extrabold text-gray-900">{title}</Text>
            {!!subtitle && <Text className="text-xs text-gray-500">{subtitle}</Text>}
          </View>
        </View>
        {!!right && (
          <View className="flex-row flex-wrap items-center" style={{ gap: 8 }}>
            {right}
          </View>
        )}
      </View>
    </View>
  );
}

export function BookStats({ children }: { children: ReactNode }) {
  return (
    <View className="flex-row flex-wrap" style={{ gap: 10 }}>
      {children}
    </View>
  );
}

export function BookStat({
  label,
  value,
  color,
  onPress,
}: {
  label: string;
  /** Already formatted, e.g. "NPR 12,000" or "14". */
  value: string;
  color: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="rounded-xl border border-gray-200 bg-white px-3.5 py-2.5"
      style={{ flexGrow: 1, flexBasis: 140 }}
    >
      <Text className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</Text>
      <Text className="mt-0.5 text-[16px] font-extrabold" style={{ color }}>
        {value}
      </Text>
    </Pressable>
  );
}

export function Pill({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <View className="self-start rounded-full px-2 py-0.5" style={{ backgroundColor: bg }}>
      <Text className="text-[10.5px] font-bold" style={{ color }} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

export interface BookColumn<T> {
  key: string;
  label: string;
  /** Fixed width; leave out for the one column that takes the rest. */
  width?: number;
  align?: 'left' | 'right';
  render: (row: T, index: number) => ReactNode;
}

const CELL = 'px-2.5 py-2 border-r border-gray-200';

/** One bordered table: grey header row, bordered cells, optional day-group
 * rows and a totals footer. The single flexible column (the one without a
 * `width`) must come before any footer cells, which line up with the fixed
 * columns after it. */
export function BookTable<T>({
  columns,
  rows,
  rowKey,
  onRowPress,
  groupOf,
  footer,
}: {
  columns: BookColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowPress?: (row: T) => void;
  groupOf?: (row: T) => string;
  footer?: { label: string; cells: Record<string, ReactNode> };
}) {
  const cellStyle = (c: BookColumn<T>) => (c.width ? { width: c.width } : { flex: 1, minWidth: 0 });
  const lastIndex = columns.length - 1;
  const footerStart = footer ? columns.findIndex((c) => c.key in footer.cells) : -1;

  return (
    <View className="overflow-hidden rounded-xl border border-gray-300 bg-white">
      <View className="flex-row border-b border-gray-300 bg-gray-50">
        {columns.map((c, i) => (
          <Text
            key={c.key}
            className={`px-2.5 py-2 text-[11.5px] font-bold text-gray-600 ${i < lastIndex ? 'border-r border-gray-200' : ''} ${c.align === 'right' ? 'text-right' : ''}`}
            style={cellStyle(c)}
          >
            {c.label}
          </Text>
        ))}
      </View>

      {rows.map((row, index) => {
        const group = groupOf?.(row);
        const showGroup = group != null && (index === 0 || groupOf!(rows[index - 1]) !== group);
        return (
          <View key={rowKey(row)}>
            {showGroup && (
              <View className="border-b border-gray-200 bg-gray-50 px-2.5 py-1.5">
                <Text className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{group}</Text>
              </View>
            )}
            <Pressable
              onPress={onRowPress ? () => onRowPress(row) : undefined}
              disabled={!onRowPress}
              className="flex-row border-b border-gray-200"
            >
              {columns.map((c, i) => (
                <View
                  key={c.key}
                  className={`px-2.5 py-2 ${i < lastIndex ? 'border-r border-gray-200' : ''}`}
                  style={[cellStyle(c), c.align === 'right' ? { alignItems: 'flex-end', justifyContent: 'center' } : { justifyContent: 'center' }]}
                >
                  {c.render(row, index)}
                </View>
              ))}
            </Pressable>
          </View>
        );
      })}

      {footer && footerStart >= 0 && (
        <View className="flex-row bg-gray-50">
          <Text className={`${CELL} flex-1 text-right text-[12.5px] font-bold text-gray-700`}>{footer.label}</Text>
          {columns.slice(footerStart).map((c, i, arr) => (
            <View
              key={c.key}
              className={`px-2.5 py-2 ${i < arr.length - 1 ? 'border-r border-gray-200' : ''}`}
              style={{ width: c.width, alignItems: 'flex-end', justifyContent: 'center' }}
            >
              {footer.cells[c.key]}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
