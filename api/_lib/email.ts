// Construcción del correo de recordatorio (HTML + texto plano). Sin dependencias externas.
import { formatDate, formatTime, relativeDays, weekdayName } from '../../shared/dates.js'
import { DIFFICULTY_LABELS, LIKING_LABELS, type Liking } from '../../shared/labels.js'
import { isHard } from '../../shared/reminders.js'

export interface EmailExam {
  id: string
  subjectName: string
  examDate: string
  examTime: string | null
  daysLeft: number
  difficulty: number
  liking: Liking | null
  note: string | null
}

export interface EmailReminder extends EmailExam {
  offset: number
  /** El aviso es el adelanto extra por ser una asignatura difícil. */
  hardExtra: boolean
}

export interface ReminderEmailInput {
  studentName: string
  reminders: EmailReminder[]
  /** Exámenes de las próximas semanas (incluidos los de los avisos), ordenados por fecha. */
  upcoming: EmailExam[]
  appUrl: string | null
  test?: boolean
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

function when(exam: EmailExam): string {
  const time = exam.examTime ? ` a las ${formatTime(exam.examTime)}` : ''
  return `${weekdayName(exam.examDate)} ${formatDate(exam.examDate)}${time}`
}

function daysText(daysLeft: number): string {
  return relativeDays(daysLeft).toLowerCase()
}

function headline(r: EmailReminder): string {
  if (r.hardExtra) return 'Aviso adelantado: asignatura difícil, buen momento para empezar.'
  if (r.daysLeft >= 10) return 'Aviso inicial: ayúdala a empezar con calma.'
  if (r.daysLeft >= 4) return 'Seguimiento: comprueba cómo lo lleva.'
  if (r.daysLeft >= 2) return 'Comprueba que el examen no se le está echando encima.'
  return 'Aviso final: el examen es inminente.'
}

export function buildReminderEmail(input: ReminderEmailInput): { subject: string; html: string; text: string } {
  const { studentName, reminders, upcoming, appUrl } = input
  const reminderIds = new Set(reminders.map((r) => r.id))
  const others = upcoming.filter((e) => !reminderIds.has(e.id))
  const prefix = input.test ? '[Prueba] ' : ''

  const subject =
    reminders.length === 0
      ? `${prefix}ElenaStudio: recordatorios de ${studentName}`
      : reminders.length === 1
      ? `${prefix}${studentName}: ${reminders[0].subjectName} ${daysText(reminders[0].daysLeft)} (${formatDate(reminders[0].examDate)})`
      : `${prefix}${studentName}: ${reminders.length} exámenes que vigilar`

  const text: string[] = [
    input.test ? 'Esto es un correo de prueba de ElenaStudio. Los avisos reales tendrán este formato.\n' : '',
    `Recordatorios de exámenes de ${studentName}:`,
    '',
  ]
  for (const r of reminders) {
    text.push(
      `• ${r.subjectName} — ${when(r)} (${daysText(r.daysLeft)})`,
      `  ${headline(r)}`,
      `  Dificultad: ${r.difficulty}/5 (${DIFFICULTY_LABELS[r.difficulty]})${r.liking ? ` · ${LIKING_LABELS[r.liking]}` : ''}`,
      ...(r.note ? [`  Nota: ${r.note}`] : []),
      '',
    )
  }
  text.push(`Otros exámenes próximos de ${studentName}:`)
  if (others.length === 0) text.push('  Ninguno en las próximas semanas.')
  for (const e of others) text.push(`  - ${formatDate(e.examDate)} (${daysText(e.daysLeft)}): ${e.subjectName}, dificultad ${e.difficulty}/5`)
  if (appUrl) text.push('', `Abrir ElenaStudio: ${appUrl}`)

  const card = (r: EmailReminder) => `
    <div style="border:1px solid #e0e7ff;border-radius:12px;padding:16px;margin:0 0 12px;background:#fff">
      <div style="font-size:18px;font-weight:600;color:#1e1b4b">${escapeHtml(r.subjectName)}</div>
      <div style="color:#4338ca;margin:4px 0 8px;font-weight:600">${escapeHtml(relativeDays(r.daysLeft))} · ${escapeHtml(when(r))}</div>
      <div style="color:#334155;margin-bottom:8px">${escapeHtml(headline(r))}</div>
      <div style="color:#475569;font-size:14px">
        Dificultad: <strong${isHard(r.difficulty) ? ' style="color:#b45309"' : ''}>${r.difficulty}/5</strong> (${escapeHtml(DIFFICULTY_LABELS[r.difficulty])})${r.liking ? ` · ${escapeHtml(LIKING_LABELS[r.liking])}` : ''}
      </div>
      ${r.note ? `<div style="color:#475569;font-size:14px;margin-top:6px">Nota: ${escapeHtml(r.note)}</div>` : ''}
    </div>`

  const otherRows = others
    .map(
      (e) => `<tr>
        <td style="padding:6px 8px;white-space:nowrap;color:#334155">${formatDate(e.examDate)}</td>
        <td style="padding:6px 8px;color:#64748b;white-space:nowrap">${escapeHtml(relativeDays(e.daysLeft))}</td>
        <td style="padding:6px 8px;color:#1e293b">${escapeHtml(e.subjectName)}</td>
        <td style="padding:6px 8px;color:${isHard(e.difficulty) ? '#b45309' : '#64748b'};white-space:nowrap">${e.difficulty}/5</td>
      </tr>`,
    )
    .join('')

  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f8fafc;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px">
    ${input.test ? '<p style="background:#fef3c7;color:#92400e;padding:8px 12px;border-radius:8px">Correo de prueba: los avisos reales tendrán este formato.</p>' : ''}
    <h1 style="font-size:20px;color:#1e1b4b;margin:0 0 16px">Exámenes de ${escapeHtml(studentName)}</h1>
    ${reminders.map(card).join('')}
    <h2 style="font-size:16px;color:#1e1b4b;margin:24px 0 8px">Otros exámenes próximos</h2>
    ${
      others.length
        ? `<table style="width:100%;border-collapse:collapse;background:#fff;border-radius:12px;font-size:14px">${otherRows}</table>`
        : '<p style="color:#64748b;margin:0">Ninguno en las próximas semanas.</p>'
    }
    ${
      appUrl
        ? `<p style="margin:24px 0 0"><a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600">Abrir ElenaStudio</a></p>`
        : ''
    }
  </div></body></html>`

  return { subject, html, text: text.filter((l, i) => l !== '' || i > 0).join('\n') }
}
