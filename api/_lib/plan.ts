// Decide qué avisos tocan hoy. Lógica pura, sin acceso a red ni base de datos.
import { daysBetween } from '../../shared/dates.js'
import type { Liking } from '../../shared/labels.js'
import { CONTEXT_WINDOW_DAYS, dueOffset, normalizeOffsets, offsetsForExam, type ReminderRules } from '../../shared/reminders.js'
import type { EmailExam, EmailReminder } from './email.js'

export interface ExamRow {
  id: string
  exam_date: string
  exam_time: string | null
  note: string | null
  subject: { name: string; difficulty: number; liking: Liking | null } | null
}

export function toEmailExam(row: ExamRow, today: string): EmailExam {
  return {
    id: row.id,
    subjectName: row.subject?.name ?? 'Asignatura',
    examDate: row.exam_date,
    examTime: row.exam_time,
    daysLeft: daysBetween(today, row.exam_date),
    difficulty: row.subject?.difficulty ?? 3,
    liking: row.subject?.liking ?? null,
    note: row.note,
  }
}

export function planReminders(exams: ExamRow[], rules: ReminderRules, today: string) {
  const all = exams
    .map((row) => toEmailExam(row, today))
    .filter((e) => e.daysLeft >= 0)
    .sort((a, b) => a.examDate.localeCompare(b.examDate) || (a.examTime ?? '99').localeCompare(b.examTime ?? '99'))

  const baseMax = normalizeOffsets(rules.offsets)[0]
  const due: EmailReminder[] = []
  for (const exam of all) {
    const offset = dueOffset(exam.daysLeft, offsetsForExam(exam.difficulty, rules))
    if (offset !== null) due.push({ ...exam, offset, hardExtra: offset > baseMax })
  }
  const upcoming = all.filter((e) => e.daysLeft <= CONTEXT_WINDOW_DAYS)
  return { due, upcoming }
}
