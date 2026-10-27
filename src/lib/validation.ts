import { addDays, isValidIsoDate } from '../../shared/dates'

export const MAX_NOTE_LENGTH = 500
export const MAX_SUBJECT_NAME = 60

export interface ExamInput {
  subject_id: string
  exam_date: string
  exam_time: string
  note: string
}

export type ExamErrors = Partial<Record<keyof ExamInput, string>>

/**
 * Valida el formulario de examen. Las fechas pasadas solo se permiten
 * si se está editando un examen que ya tenía esa fecha.
 */
export function validateExam(input: ExamInput, today: string, originalDate?: string): ExamErrors {
  const errors: ExamErrors = {}
  if (!input.subject_id) errors.subject_id = 'Elige una asignatura.'
  if (!input.exam_date) errors.exam_date = 'Indica la fecha del examen.'
  else if (!isValidIsoDate(input.exam_date)) errors.exam_date = 'La fecha no es válida.'
  else if (input.exam_date < today && input.exam_date !== originalDate) errors.exam_date = 'La fecha ya ha pasado.'
  else if (input.exam_date > addDays(today, 366)) errors.exam_date = 'La fecha está a más de un año vista.'
  if (input.exam_time && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(input.exam_time)) errors.exam_time = 'La hora no es válida.'
  if (input.note.length > MAX_NOTE_LENGTH) errors.note = `Máximo ${MAX_NOTE_LENGTH} caracteres.`
  return errors
}

export function validateSubjectName(name: string, existing: { id: string; name: string }[], ownId?: string): string | null {
  const clean = name.trim()
  if (!clean) return 'Escribe el nombre de la asignatura.'
  if (clean.length > MAX_SUBJECT_NAME) return `Máximo ${MAX_SUBJECT_NAME} caracteres.`
  if (existing.some((s) => s.id !== ownId && s.name.trim().toLowerCase() === clean.toLowerCase()))
    return 'Ya tienes una asignatura con ese nombre.'
  return null
}
