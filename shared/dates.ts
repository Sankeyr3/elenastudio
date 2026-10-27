// Utilidades de fechas compartidas por el frontend y la tarea programada.
// Todas las fechas de examen se manejan como texto ISO 'AAAA-MM-DD' (tipo `date` de Postgres)
// y "hoy" se calcula siempre en la zona horaria Europe/Madrid.

export const TIME_ZONE = 'Europe/Madrid'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Fecha de hoy en Madrid, como 'AAAA-MM-DD'. */
export function todayInMadrid(now: Date = new Date()): string {
  // en-CA formatea como AAAA-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function toUtc(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function fromUtc(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false
  const date = toUtc(value)
  return !Number.isNaN(date.getTime()) && fromUtc(date) === value
}

export function addDays(iso: string, days: number): string {
  const date = toUtc(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return fromUtc(date)
}

/** Días naturales desde `from` hasta `to` (negativo si `to` es anterior). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000)
}

/** 'AAAA-MM-DD' -> 'DD/MM/AAAA' */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** 'HH:MM:SS' o 'HH:MM' -> 'HH:MM' */
export function formatTime(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : ''
}

export function weekdayName(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', { weekday: 'long', timeZone: 'UTC' }).format(toUtc(iso))
}

export function monthName(year: number, monthIndex: number): string {
  return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, monthIndex, 1)),
  )
}

/** Día de la semana empezando en lunes (0 = lunes ... 6 = domingo). */
export function weekdayMondayFirst(iso: string): number {
  return (toUtc(iso).getUTCDay() + 6) % 7
}

export function relativeDays(daysLeft: number): string {
  if (daysLeft === 0) return 'Hoy'
  if (daysLeft === 1) return 'Mañana'
  if (daysLeft === -1) return 'Ayer'
  if (daysLeft < 0) return `Hace ${-daysLeft} días`
  return `En ${daysLeft} días`
}
