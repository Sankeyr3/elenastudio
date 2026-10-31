// Reglas de los recordatorios. Las usan tanto la tarea programada (api/cron/reminders.ts)
// como el panel del ayudante para mostrar los próximos avisos.
import { addDays } from './dates.js'

export const DEFAULT_OFFSETS = [14, 7, 3, 1]
export const DEFAULT_HARD_EXTRA_DAYS = 7
/** A partir de esta dificultad una asignatura se considera "difícil". */
export const HARD_DIFFICULTY = 4
export const MAX_OFFSETS = 6
export const MAX_OFFSET_DAYS = 90
export const MAX_HARD_EXTRA_DAYS = 30
/** Ventana de "exámenes próximos" que se tienen en cuenta (p. ej. para la notificación de prueba). */
export const CONTEXT_WINDOW_DAYS = 21

export interface ReminderRules {
  offsets: number[]
  hard_extra_days: number
}

export function isHard(difficulty: number): boolean {
  return difficulty >= HARD_DIFFICULTY
}

/** Normaliza una lista de plazos: enteros únicos, ordenados de mayor a menor. */
export function normalizeOffsets(offsets: number[]): number[] {
  return [...new Set(offsets.filter((o) => Number.isInteger(o) && o >= 0 && o <= MAX_OFFSET_DAYS))].sort(
    (a, b) => b - a,
  )
}

/**
 * Plazos (días antes del examen) que aplican a un examen.
 * Regla sencilla: si la asignatura es difícil (4 o 5), se añade un aviso inicial
 * `hard_extra_days` días antes del primer plazo (por defecto 14 + 7 = 21 días antes).
 */
export function offsetsForExam(difficulty: number, rules: ReminderRules): number[] {
  const offsets = normalizeOffsets(rules.offsets)
  if (offsets.length > 0 && isHard(difficulty) && rules.hard_extra_days > 0) {
    offsets.unshift(offsets[0] + rules.hard_extra_days)
  }
  return offsets
}

/**
 * Plazo que "toca" hoy para un examen al que le quedan `daysLeft` días, o null.
 *
 * Cada plazo cubre una ventana que llega hasta el siguiente plazo más corto:
 * con [14, 7, 3, 1], el aviso de 14 días corresponde a 8–14 días restantes, el de 7 a 4–7, etc.
 * Así, si la tarea diaria falla un día o Elena añade un examen con poca antelación,
 * se envía el aviso que corresponde ahora (uno solo), en lugar de perderlo o de enviar varios a la vez.
 */
export function dueOffset(daysLeft: number, offsets: number[]): number | null {
  const sorted = normalizeOffsets(offsets)
  if (daysLeft < 0) return null
  for (let i = 0; i < sorted.length; i++) {
    const upper = sorted[i]
    const lower = i + 1 < sorted.length ? sorted[i + 1] : upper === 0 ? -1 : 0
    if (daysLeft <= upper && daysLeft > lower) return upper
  }
  return null
}

export interface PlannedReminder {
  offset: number
  /** Fecha prevista de envío ('AAAA-MM-DD'). Si `dueNow`, es hoy. */
  date: string
  dueNow: boolean
}

/**
 * Siguiente aviso pendiente de un examen (para mostrarlo en el panel), o null si ya no quedan.
 * `sentOffsets` son los plazos ya enviados para esa fecha de examen.
 */
export function nextReminder(
  examDate: string,
  daysLeft: number,
  offsets: number[],
  sentOffsets: Set<number>,
  today: string,
): PlannedReminder | null {
  const due = dueOffset(daysLeft, offsets)
  if (due !== null && !sentOffsets.has(due)) return { offset: due, date: today, dueNow: true }
  // El siguiente plazo futuro es el mayor que todavía sea menor que los días restantes.
  const future = normalizeOffsets(offsets).find((o) => o < daysLeft)
  if (future === undefined) return null
  return { offset: future, date: addDays(examDate, -future), dueNow: false }
}

/** Criterio sencillo de "requiere atención" para el panel del ayudante. */
export function needsAttention(daysLeft: number, difficulty: number): boolean {
  return daysLeft >= 0 && (daysLeft <= 3 || (isHard(difficulty) && daysLeft <= 14))
}

/**
 * ¿Debe estudiar hoy para este examen? Sí mientras esté dentro de la ventana de avisos
 * (desde el primer plazo hasta la víspera). El día del examen ya no cuenta como estudio.
 */
export function shouldStudyToday(daysLeft: number, difficulty: number, rules: ReminderRules): boolean {
  const offsets = offsetsForExam(difficulty, rules)
  return offsets.length > 0 && daysLeft >= 1 && daysLeft <= offsets[0]
}

export function validateRules(rules: ReminderRules): string | null {
  if (rules.offsets.length === 0) return 'Añade al menos un plazo.'
  if (rules.offsets.length > MAX_OFFSETS) return `Como máximo ${MAX_OFFSETS} plazos.`
  if (rules.offsets.some((o) => !Number.isInteger(o) || o < 0 || o > MAX_OFFSET_DAYS))
    return `Cada plazo debe ser un número entero entre 0 y ${MAX_OFFSET_DAYS} días.`
  if (new Set(rules.offsets).size !== rules.offsets.length) return 'Hay plazos repetidos.'
  if (!Number.isInteger(rules.hard_extra_days) || rules.hard_extra_days < 0 || rules.hard_extra_days > MAX_HARD_EXTRA_DAYS)
    return `El adelanto para asignaturas difíciles debe estar entre 0 y ${MAX_HARD_EXTRA_DAYS} días.`
  return null
}
