// Tarea programada: Vercel la llama una vez al día (ver vercel.json) y envía los avisos que tocan.
//
// Seguridad: solo responde si la cabecera Authorization es "Bearer <CRON_SECRET>".
// Vercel añade esa cabecera automáticamente cuando la variable CRON_SECRET existe en el proyecto.
//
// Parámetros opcionales (también requieren la cabecera):
//   ?dry=1   no envía ni guarda nada; devuelve qué avisos tocarían hoy.
//   ?test=1  envía un correo de prueba con los exámenes próximos, sin registrar avisos.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'node:crypto'
import { addDays, todayInMadrid } from '../../shared/dates.js'
import { DEFAULT_HARD_EXTRA_DAYS, DEFAULT_OFFSETS, offsetsForExam } from '../../shared/reminders.js'
import { buildReminderEmail, type EmailReminder } from '../_lib/email.js'
import { planReminders, type ExamRow } from '../_lib/plan.js'

export const config = { maxDuration: 30 }

function json(body: unknown, status = 200) {
  return Response.json(body, { status })
}

function authorized(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`)
  const received = Buffer.from(header ?? '')
  return received.length === expected.length && timingSafeEqual(received, expected)
}

interface SendResult {
  ok: boolean
  id: string | null
  error: string | null
}

async function sendEmail(to: string, email: { subject: string; html: string; text: string }): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) {
    return { ok: false, id: null, error: 'Correo sin configurar: faltan RESEND_API_KEY o EMAIL_FROM en Vercel.' }
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], ...email }),
    })
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string }
    if (!res.ok) return { ok: false, id: null, error: `Resend ${res.status}: ${body.message ?? 'error desconocido'}` }
    return { ok: true, id: body.id ?? null, error: null }
  } catch (err) {
    return { ok: false, id: null, error: `No se pudo contactar con Resend: ${(err as Error).message}` }
  }
}

async function processHelper(
  db: SupabaseClient<any, 'elenastudio'>,
  link: { student_id: string; helper_id: string },
  today: string,
  mode: { dry: boolean; test: boolean },
) {
  const { data: settings, error: settingsError } = await db
    .from('reminder_settings')
    .select('enabled, notify_email, offsets, hard_extra_days')
    .eq('helper_id', link.helper_id)
    .maybeSingle()
  if (settingsError) throw settingsError
  if (!settings) return { helper: link.helper_id, skipped: 'sin preferencias' }
  if (!settings.enabled && !mode.test) return { helper: link.helper_id, skipped: 'avisos desactivados' }

  const { data: student } = await db.from('profiles').select('display_name').eq('id', link.student_id).single()
  const studentName: string = student?.display_name ?? 'Tu estudiante'

  const rules = {
    offsets: settings.offsets?.length ? settings.offsets : DEFAULT_OFFSETS,
    hard_extra_days: settings.hard_extra_days ?? DEFAULT_HARD_EXTRA_DAYS,
  }
  const maxLead = Math.max(...offsetsForExam(5, rules))
  const { data: exams, error: examsError } = await db
    .from('exams')
    .select('id, exam_date, exam_time, note, subject:subjects(name, difficulty, liking)')
    .eq('student_id', link.student_id)
    .gte('exam_date', today)
    .lte('exam_date', addDays(today, Math.max(maxLead, 21)))
    .order('exam_date')
    .order('exam_time')
  if (examsError) throw examsError

  const { due, upcoming } = planReminders((exams ?? []) as unknown as ExamRow[], rules, today)
  const appUrl = process.env.APP_URL || null

  if (mode.test) {
    const sample: EmailReminder[] = due.length
      ? due
      : upcoming.slice(0, 1).map((e) => ({ ...e, offset: e.daysLeft, hardExtra: false }))
    const result = await sendEmail(
      settings.notify_email,
      buildReminderEmail({ studentName, reminders: sample, upcoming, appUrl, test: true }),
    )
    return { helper: link.helper_id, test: true, to: settings.notify_email, ...result }
  }

  if (mode.dry) {
    return {
      helper: link.helper_id,
      dry: true,
      due: due.map((r) => ({ subject: r.subjectName, exam_date: r.examDate, days_left: r.daysLeft, offset: r.offset })),
    }
  }

  if (due.length === 0) return { helper: link.helper_id, sent: 0 }

  // Reserva atómica: solo se devuelven avisos que nadie ha enviado ni está enviando.
  const { data: claimed, error: claimError } = await db.rpc('claim_reminders', {
    p_items: due.map((r) => ({
      helper_id: link.helper_id,
      exam_id: r.id,
      exam_date: r.examDate,
      offset_days: r.offset,
      subject_name: r.subjectName,
    })),
  })
  if (claimError) throw claimError
  const claimedRows = (claimed ?? []) as { id: string; exam_id: string; offset_days: number }[]
  if (claimedRows.length === 0) return { helper: link.helper_id, sent: 0, alreadySent: due.length }

  const claimedKeys = new Set(claimedRows.map((c) => `${c.exam_id}:${c.offset_days}`))
  const reminders = due.filter((r) => claimedKeys.has(`${r.id}:${r.offset}`))

  const result = await sendEmail(
    settings.notify_email,
    buildReminderEmail({ studentName, reminders, upcoming, appUrl }),
  )
  const { error: finishError } = await db.rpc('finish_reminders', {
    p_ids: claimedRows.map((c) => c.id),
    p_ok: result.ok,
    p_error: result.error,
    p_email_id: result.id,
  })
  if (finishError) throw finishError

  return { helper: link.helper_id, sent: result.ok ? reminders.length : 0, error: result.error }
}

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET
  if (!secret) return json({ error: 'CRON_SECRET no está configurado en Vercel.' }, 500)
  if (!authorized(request.headers.get('authorization'), secret)) return json({ error: 'No autorizado' }, 401)

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Faltan SUPABASE_URL/VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Vercel.' }, 500)
  }

  const params = new URL(request.url).searchParams
  const mode = { dry: params.get('dry') === '1', test: params.get('test') === '1' }
  const db = createClient(supabaseUrl, serviceKey, {
    db: { schema: 'elenastudio' },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const today = todayInMadrid()

  try {
    const { data: links, error } = await db.from('helper_links').select('student_id, helper_id')
    if (error) throw error
    const results = []
    for (const link of links ?? []) results.push(await processHelper(db, link, today, mode))
    const failed = results.some((r) => 'error' in r && r.error)
    console.log(JSON.stringify({ today, results }))
    return json({ today, results }, failed ? 502 : 200)
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err)
    console.error('Error en el cron de recordatorios:', message)
    return json({ error: message }, 500)
  }
}
