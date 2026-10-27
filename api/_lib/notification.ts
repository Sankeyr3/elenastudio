// Texto de la notificación push de recordatorio. Sin dependencias externas.
import { formatDate, formatTime, relativeDays, weekdayName } from '../../shared/dates.js'
import { DIFFICULTY_LABELS } from '../../shared/labels.js'
import type { DueReminder } from './plan.js'

export interface ReminderNotificationInput {
  studentName: string
  reminders: DueReminder[]
  appUrl: string | null
  test?: boolean
}

/** Lo que recibe el service worker (public/sw.js) y muestra como notificación. */
export interface NotificationPayload {
  title: string
  body: string
  url: string
  /** Notificaciones con la misma etiqueta se sustituyen en lugar de acumularse. */
  tag: string
}

function when(r: DueReminder): string {
  const time = r.examTime ? ` a las ${formatTime(r.examTime)}` : ''
  return `${weekdayName(r.examDate)} ${formatDate(r.examDate)}${time}`
}

function daysText(daysLeft: number): string {
  return relativeDays(daysLeft).toLowerCase()
}

function headline(r: DueReminder): string {
  if (r.hardExtra) return 'Asignatura difícil: buen momento para que empiece.'
  if (r.daysLeft >= 10) return 'Ayúdala a empezar con calma.'
  if (r.daysLeft >= 4) return 'Pregúntale cómo lo lleva.'
  if (r.daysLeft >= 2) return 'Comprueba que no se le está echando encima.'
  return 'El examen es inminente.'
}

export function buildReminderNotification(input: ReminderNotificationInput): NotificationPayload {
  const { studentName, reminders } = input
  const prefix = input.test ? '[Prueba] ' : ''
  const url = input.appUrl || '/'

  if (reminders.length === 0) {
    return {
      title: `${prefix}ElenaStudio`,
      body: `Así te llegarán los avisos para recordar a ${studentName} sus exámenes.`,
      url,
      tag: 'elenastudio-test',
    }
  }

  if (reminders.length === 1) {
    const [r] = reminders
    const lines = [
      `${when(r)}. ${headline(r)}`,
      `Dificultad ${r.difficulty}/5 (${DIFFICULTY_LABELS[r.difficulty]}).`,
      ...(r.note ? [`Nota: ${r.note}`] : []),
    ]
    return {
      title: `${prefix}Avisa a ${studentName}: ${r.subjectName} ${daysText(r.daysLeft)}`,
      body: lines.join('\n'),
      url,
      tag: input.test ? 'elenastudio-test' : 'elenastudio-reminders',
    }
  }

  return {
    title: `${prefix}Avisa a ${studentName}: ${reminders.length} exámenes`,
    body: reminders
      .map((r) => `• ${r.subjectName}: ${daysText(r.daysLeft)} (${formatDate(r.examDate)}), dificultad ${r.difficulty}/5`)
      .join('\n'),
    url,
    tag: input.test ? 'elenastudio-test' : 'elenastudio-reminders',
  }
}
