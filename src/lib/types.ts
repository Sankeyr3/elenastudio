import type { SubjectColor } from '../../shared/colors'
import type { Liking } from '../../shared/labels'

export type Role = 'student' | 'helper'

export interface Profile {
  id: string
  role: Role
  display_name: string
}

export interface Subject {
  id: string
  name: string
  difficulty: number
  liking: Liking | null
  color: SubjectColor | null
  /** Icono dibujado a mano (ver shared/icon.ts). */
  icon: string | null
}

export interface Exam {
  id: string
  subject_id: string
  exam_date: string
  exam_time: string | null
  note: string | null
}

/** Examen con su asignatura ya resuelta. */
export interface ExamWithSubject extends Exam {
  subject: Subject
}

export interface ReminderSettings {
  helper_id: string
  enabled: boolean
  notify_email: string
  offsets: number[]
  hard_extra_days: number
}

export interface ReminderLog {
  id: string
  exam_id: string | null
  exam_date: string
  offset_days: number
  subject_name: string
  status: 'sending' | 'sent' | 'failed'
  attempts: number
  last_error: string | null
  created_at: string
  sent_at: string | null
}
