// All LNPATS business dates and displayed times use Liberia time (Africa/Monrovia, GMT),
// never the device clock or its time zone.
export const LIBERIA_TIME_ZONE = 'Africa/Monrovia';

/** Today's date in Liberia as YYYY-MM-DD. */
export function liberiaDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: LIBERIA_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** A timestamp shown to users, in Liberia time: "28/10/2026, 12:32". */
export function liberiaDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { timeZone: LIBERIA_TIME_ZONE, dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

/** A date-only display in Liberia time: "28/10/2026". */
export function liberiaDateOnly(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { timeZone: LIBERIA_TIME_ZONE, dateStyle: 'short' }).format(new Date(value));
}

/** A time-only display in Liberia time: "12:32". */
export function liberiaTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { timeZone: LIBERIA_TIME_ZONE, timeStyle: 'short' }).format(new Date(value));
}
