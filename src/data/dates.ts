import { SLOTS, WEEKDAYS, type MeetingTime, type Slot, type Weekday } from './types';

/** Local date as YYYY-MM-DD. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** Weekday name for a date, or null on weekends. */
export function weekdayOf(iso: string): Weekday | null {
  const js = parseISODate(iso).getDay(); // 0 = Sunday
  return js >= 1 && js <= 5 ? WEEKDAYS[js - 1] : null;
}

/** Monday of the week containing `iso` (weekends roll forward to next Monday). */
export function mondayOf(iso: string): string {
  const js = parseISODate(iso).getDay();
  if (js === 0) return addDays(iso, 1);
  if (js === 6) return addDays(iso, 2);
  return addDays(iso, 1 - js);
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return parseISODate(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...opts,
  });
}

export function timeAgo(isoDateTime: string): string {
  const diff = Date.now() - new Date(isoDateTime).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoDateTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const SLOT_LABELS: Partial<Record<Slot, string>> = {
  'flex time': 'Flex Time',
  'tiger time': 'Tiger Time',
};

/** How a period is written in sentences: "lunch", "Tiger Time". */
export function slotLabel(slot: Slot): string {
  return SLOT_LABELS[slot] ?? slot;
}

/** Capitalized, for dropdowns and headings: "Lunch", "Tiger Time". */
export function slotTitle(slot: Slot): string {
  const l = slotLabel(slot);
  return l[0].toUpperCase() + l.slice(1);
}

export function describeMeeting(m: MeetingTime): string {
  return `${m.day} ${slotLabel(m.slot)}`;
}

export function slotOrder(s: Slot): number {
  return SLOTS.indexOf(s);
}
