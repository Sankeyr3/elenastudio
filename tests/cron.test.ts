// Prueba el endpoint del cron con un cliente de Supabase falso en memoria y un fetch simulado para Resend.
// (La reserva atómica real de avisos se prueba en SQL en db.test.ts.)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const HELPER = 'helper-1'
const STUDENT = 'student-1'

interface LogRow {
  id: string
  helper_id: string
  exam_id: string
  exam_date: string
  offset_days: number
  status: 'sending' | 'sent' | 'failed'
  attempts: number
  last_error: string | null
}

const state = {
  exams: [] as Record<string, unknown>[],
  logs: [] as LogRow[],
}

function fakeClient() {
  const tables: Record<string, () => Record<string, unknown>[]> = {
    helper_links: () => [{ student_id: STUDENT, helper_id: HELPER }],
    reminder_settings: () => [
      { helper_id: HELPER, enabled: true, notify_email: 'yo@example.org', offsets: [14, 7, 3, 1], hard_extra_days: 7 },
    ],
    profiles: () => [{ id: STUDENT, display_name: 'Elena' }],
    exams: () => state.exams,
  }
  return {
    from(table: string) {
      let rows = tables[table]()
      const builder = {
        select: () => builder,
        eq: (col: string, v: unknown) => ((rows = rows.filter((r) => r[col] === v)), builder),
        gte: (col: string, v: string) => ((rows = rows.filter((r) => String(r[col]) >= v)), builder),
        lte: (col: string, v: string) => ((rows = rows.filter((r) => String(r[col]) <= v)), builder),
        order: () => builder,
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        single: async () => ({ data: rows[0] ?? null, error: null }),
        then: (resolve: (v: unknown) => void) => resolve({ data: rows, error: null }),
      }
      return builder
    },
    async rpc(name: string, args: Record<string, unknown>) {
      if (name === 'claim_reminders') {
        const claimed: LogRow[] = []
        for (const item of args.p_items as LogRow[]) {
          const existing = state.logs.find(
            (l) => l.exam_id === item.exam_id && l.exam_date === item.exam_date && l.offset_days === item.offset_days,
          )
          if (existing && existing.status === 'failed' && existing.attempts < 5) {
            existing.status = 'sending'
            claimed.push(existing)
          } else if (!existing) {
            const row: LogRow = { ...item, id: `log-${state.logs.length}`, status: 'sending', attempts: 0, last_error: null }
            state.logs.push(row)
            claimed.push(row)
          }
        }
        return { data: claimed, error: null }
      }
      if (name === 'finish_reminders') {
        for (const l of state.logs.filter((l) => (args.p_ids as string[]).includes(l.id))) {
          l.status = args.p_ok ? 'sent' : 'failed'
          l.attempts++
          l.last_error = args.p_error as string | null
        }
        return { data: null, error: null }
      }
      throw new Error(`rpc desconocida ${name}`)
    },
  }
}

vi.mock('@supabase/supabase-js', () => ({ createClient: () => fakeClient() }))

const { GET } = await import('../api/cron/reminders')

const call = (query = '', auth: string | null = 'Bearer secreto-de-prueba-123456') =>
  GET(new Request(`https://app.test/api/cron/reminders${query}`, { headers: auth ? { authorization: auth } : {} }))

let resendCalls: { to: string[]; subject: string; text: string }[]

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-22T07:30:00Z')) // 09:30 en Madrid
  vi.stubEnv('CRON_SECRET', 'secreto-de-prueba-123456')
  vi.stubEnv('VITE_SUPABASE_URL', 'https://demo.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key')
  vi.stubEnv('RESEND_API_KEY', 're_test')
  vi.stubEnv('EMAIL_FROM', 'ElenaStudio <onboarding@resend.dev>')
  vi.stubEnv('APP_URL', 'https://elenastudio.vercel.app')
  state.logs = []
  state.exams = [
    { id: 'e1', student_id: STUDENT, exam_date: '2026-10-29', exam_time: '09:00:00', note: 'Tema 3', subject: { name: 'Historia', difficulty: 5, liking: 'poco' } },
    { id: 'e2', student_id: STUDENT, exam_date: '2026-10-29', exam_time: null, note: null, subject: { name: 'Dibujo técnico', difficulty: 1, liking: 'mucho' } },
    { id: 'e3', student_id: STUDENT, exam_date: '2026-12-20', exam_time: null, note: null, subject: { name: 'Inglés', difficulty: 2, liking: null } },
  ]
  resendCalls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      resendCalls.push(JSON.parse(String(init.body)))
      return Response.json({ id: `email-${resendCalls.length}` })
    }),
  )
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('GET /api/cron/reminders', () => {
  it('rechaza peticiones sin el secreto correcto', async () => {
    expect((await call('', null)).status).toBe(401)
    expect((await call('', 'Bearer otro')).status).toBe(401)
    expect(resendCalls).toHaveLength(0)
    expect(state.logs).toHaveLength(0)
  })

  it('no funciona si CRON_SECRET no está configurado', async () => {
    vi.stubEnv('CRON_SECRET', '')
    expect((await call()).status).toBe(500)
  })

  it('envía un único correo con los avisos de hoy y no los repite', async () => {
    const res = await call()
    expect(res.status).toBe(200)
    expect(resendCalls).toHaveLength(1)
    const [email] = resendCalls
    expect(email.to).toEqual(['yo@example.org'])
    expect(email.subject).toBe('Elena: 2 exámenes que vigilar')
    expect(email.text).toContain('Historia — jueves 29/10/2026 a las 09:00 (en 7 días)')
    expect(email.text).toContain('Dibujo técnico')
    expect(state.logs.map((l) => [l.exam_id, l.offset_days, l.status])).toEqual([
      ['e1', 7, 'sent'],
      ['e2', 7, 'sent'],
    ])

    // Segunda ejecución el mismo día (Vercel puede duplicar invocaciones): no se envía nada.
    const again = await call()
    expect(await again.json()).toMatchObject({ results: [{ sent: 0, alreadySent: 2 }] })
    expect(resendCalls).toHaveLength(1)
  })

  it('registra el error si falta configurar el correo, y reintenta cuando ya está', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    const res = await call()
    expect(res.status).toBe(502)
    expect(resendCalls).toHaveLength(0)
    expect(state.logs.every((l) => l.status === 'failed' && /RESEND_API_KEY/.test(l.last_error ?? ''))).toBe(true)

    vi.stubEnv('RESEND_API_KEY', 're_test')
    expect((await call()).status).toBe(200)
    expect(resendCalls).toHaveLength(1)
    expect(state.logs.every((l) => l.status === 'sent' && l.attempts === 2)).toBe(true)
  })

  it('registra los errores de Resend', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ message: 'Invalid `to` field' }, { status: 422 })))
    await call()
    expect(state.logs[0]).toMatchObject({ status: 'failed', last_error: 'Resend 422: Invalid `to` field' })
  })

  it('?dry=1 no envía ni registra nada', async () => {
    const body = await (await call('?dry=1')).json()
    expect(body.results[0].due).toHaveLength(2)
    expect(resendCalls).toHaveLength(0)
    expect(state.logs).toHaveLength(0)
  })

  it('?test=1 envía un correo de prueba sin registrar avisos', async () => {
    await call('?test=1')
    expect(resendCalls).toHaveLength(1)
    expect(resendCalls[0].subject).toMatch(/^\[Prueba\]/)
    expect(state.logs).toHaveLength(0)
  })
})
