// lib/components/finance/dashboard/dashboardData.ts
import { toBsDayChartLabel, adStringToBs, bsToAdString, BS_MONTHS } from '../../../utils/nepaliDate';
import { localTodayIso } from '../../../utils/localDate';
import type { BusinessTransaction, BusinessTransactionType } from '../../../../types/database.types';

export type PeriodKey = '7d' | '30d' | '6m' | '12m';

export const PERIODS: { key: PeriodKey; label: string; long: string }[] = [
  { key: '7d', label: '7 days', long: 'previous 7 days' },
  { key: '30d', label: '30 days', long: 'previous 30 days' },
  { key: '6m', label: '6 months', long: 'previous 6 months' },
  { key: '12m', label: '12 months', long: 'previous 12 months' },
];

export interface Bucket {
  start: number;
  end: number;
  label: string;
}

export interface DashboardRange {
  buckets: Bucket[];
  from: number;
  to: number;
  prevFrom: number;
  prevTo: number;
}

/** Epoch ms of an entry's date. A bare 'YYYY-MM-DD' is read as local midnight
 * (new Date() would read it as UTC midnight); a full timestamp is used as-is. */
export function dayTime(date: string): number {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
  }
  return new Date(date).getTime();
}

/** The date a transaction is FOR (bill date), falling back to when it was entered. */
export function txTime(t: Pick<BusinessTransaction, 'bill_date' | 'created_at'>): number {
  return dayTime(t.bill_date ?? t.created_at);
}

function dayBuckets(n: number, endOffsetDays: number): Bucket[] {
  const now = new Date();
  const out: Bucket[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - endOffsetDays - i);
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    out.push({ start: d.getTime(), end: next.getTime(), label: toBsDayChartLabel(d) });
  }
  return out;
}

// Months are Bikram Sambat months - the calendar the business actually runs
// on - so "last 6 months" lines up with Baisakh, Jestha... not AD month edges.
function bsMonthStart(idx: number): Date {
  const y = Math.floor(idx / 12);
  const m = idx % 12;
  const [yy, mm, dd] = bsToAdString(y, m, 1).split('-').map(Number);
  return new Date(yy, mm - 1, dd);
}

function monthBuckets(n: number, endOffsetMonths: number): Bucket[] {
  const bs = adStringToBs(localTodayIso());
  if (!bs) return dayBuckets(30, endOffsetMonths * 30);
  const nowIdx = bs.year * 12 + bs.month;
  const out: Bucket[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const idx = nowIdx - endOffsetMonths - i;
    out.push({
      start: bsMonthStart(idx).getTime(),
      end: bsMonthStart(idx + 1).getTime(),
      label: BS_MONTHS[((idx % 12) + 12) % 12],
    });
  }
  return out;
}

export function buildRange(period: PeriodKey): DashboardRange {
  const count = period === '7d' ? 7 : period === '30d' ? 30 : period === '6m' ? 6 : 12;
  const daily = period === '7d' || period === '30d';
  const buckets = daily ? dayBuckets(count, 0) : monthBuckets(count, 0);
  const prev = daily ? dayBuckets(count, count) : monthBuckets(count, count);
  return {
    buckets,
    from: buckets[0].start,
    to: buckets[buckets.length - 1].end,
    prevFrom: prev[0].start,
    prevTo: prev[prev.length - 1].end,
  };
}

export function sumType(txs: BusinessTransaction[], type: BusinessTransactionType, from: number, to: number): number {
  let sum = 0;
  for (const t of txs) {
    if (t.type !== type) continue;
    const time = txTime(t);
    if (time >= from && time < to) sum += t.amount;
  }
  return sum;
}

export function seriesByBucket(txs: BusinessTransaction[], type: BusinessTransactionType, buckets: Bucket[]): number[] {
  const values = buckets.map(() => 0);
  for (const t of txs) {
    if (t.type !== type) continue;
    const time = txTime(t);
    const i = buckets.findIndex((b) => time >= b.start && time < b.end);
    if (i >= 0) values[i] += t.amount;
  }
  return values;
}

/** Whole rupees with thousands separators, matching the app's existing "NPR 12,345" look. */
export function npr(v: number): string {
  return `NPR ${Math.round(v).toLocaleString()}`;
}

/** Axis-friendly amounts in the units Nepali businesses use: 25k, 1.5L (lakh), 2Cr (crore). */
export function compactNpr(v: number): string {
  const a = Math.abs(v);
  const trim = (n: number) => String(Math.round(n * 10) / 10);
  if (a >= 1e7) return `${trim(v / 1e7)}Cr`;
  if (a >= 1e5) return `${trim(v / 1e5)}L`;
  if (a >= 1e3) return `${trim(v / 1e3)}k`;
  return String(Math.round(v));
}
