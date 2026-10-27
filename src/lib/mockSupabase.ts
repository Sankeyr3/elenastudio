import { addDays, todayInMadrid } from '../../shared/dates'
import { DEFAULT_HARD_EXTRA_DAYS, DEFAULT_OFFSETS } from '../../shared/reminders'

/**
 * Cliente falso de Supabase para probar el frontend sin conexión (VITE_USE_MOCKS=true).
 * Implementa solo lo que usa la app. Los datos se guardan en localStorage; para reiniciarlos
 * borra la clave "elenastudy-mock-v1" (o usa resetMockData() desde la consola).
 */

type Row = Record<string, unknown>
type Tables = Record<string, Row[]>
type Result = { data: unknown; error: { message: string; code?: string } | null; count?: null }
type AuthEvent = 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT' | 'USER_UPDATED'

const STORAGE_KEY = 'elenastudy-mock-v1'
const DELAY_MS = 150

const STUDENT_ID = '00000000-0000-0000-0000-000000000001'
const HELPER_ID = '00000000-0000-0000-0000-000000000002'

/** Cuentas de prueba: cualquier contraseña vale. */
export const MOCK_USERS = [
  { id: STUDENT_ID, email: 'elena' },
  { id: HELPER_ID, email: 'david' },
]

function seed(): Tables {
  const today = todayInMadrid()
  const subjects = [
    { id: 's-mat', student_id: STUDENT_ID, name: 'Matemáticas', difficulty: 5, liking: 'poco', color: 'rose', icon: 'M15 30L85 30M35 30L28 82M65 30L65 76L78 82' },
    { id: 's-his', student_id: STUDENT_ID, name: 'Historia', difficulty: 3, liking: 'mucho', color: 'amber', icon: 'M25 12L75 12L50 50L75 88L25 88L50 50L25 12' },
    { id: 's-ing', student_id: STUDENT_ID, name: 'Inglés', difficulty: 2, liking: 'regular', color: 'sky', icon: null },
    { id: 's-fis', student_id: STUDENT_ID, name: 'Física', difficulty: 4, liking: null, color: 'violet', icon: 'M15 50L30 35L50 30L70 35L85 50L70 65L50 70L30 65L15 50#0ea5e9M50 15L65 30L70 50L65 70L50 85L35 70L30 50L35 30L50 15#000000M50 50L50 50' },
  ]
  const exam = (id: string, subject_id: string, days: number, exam_time: string | null, note: string | null) => ({
    id,
    student_id: STUDENT_ID,
    subject_id,
    exam_date: addDays(today, days),
    exam_time,
    note,
  })
  const exams = [
    exam('e-1', 's-mat', 2, '09:00:00', 'Temas 3 y 4: derivadas'),
    exam('e-2', 's-his', 5, null, 'Comentario de texto'),
    exam('e-3', 's-fis', 10, '11:30:00', null),
    exam('e-4', 's-ing', 20, '10:00:00', 'Listening + writing'),
    exam('e-5', 's-mat', 35, null, null),
    exam('e-8', 's-ing', 2, '12:00:00', null),
    exam('e-9', 's-fis', 2, '13:00:00', 'Tema 5'),
    exam('e-6', 's-his', -6, '12:00:00', null),
    exam('e-7', 's-ing', -15, null, 'Vocabulario unidad 2'),
  ]
  const at = (days: number) => `${addDays(today, days)}T07:00:00.000Z`
  return {
    profiles: [
      { id: STUDENT_ID, role: 'student', display_name: 'Elena' },
      { id: HELPER_ID, role: 'helper', display_name: 'David' },
    ],
    helper_links: [{ helper_id: HELPER_ID, student_id: STUDENT_ID }],
    subjects,
    exams,
    reminder_settings: [
      {
        helper_id: HELPER_ID,
        enabled: true,
        notify_email: 'david@example.com',
        offsets: DEFAULT_OFFSETS,
        hard_extra_days: DEFAULT_HARD_EXTRA_DAYS,
      },
    ],
    reminder_log: [
      log('l-1', 'e-1', exams[0].exam_date, 3, 'Matemáticas', 'sent', 1, null, at(-1)),
      log('l-2', 'e-1', exams[0].exam_date, 7, 'Matemáticas', 'sent', 1, null, at(-5)),
      log('l-3', 'e-2', exams[1].exam_date, 7, 'Historia', 'failed', 2, 'Correo sin configurar (modo mock)', at(-2)),
      log('l-4', 'e-6', exams[5].exam_date, 1, 'Historia', 'sent', 1, null, at(-7)),
    ],
  }
}

function log(
  id: string,
  exam_id: string,
  exam_date: string,
  offset_days: number,
  subject_name: string,
  status: string,
  attempts: number,
  last_error: string | null,
  created_at: string,
) {
  return {
    id,
    helper_id: HELPER_ID,
    exam_id,
    exam_date,
    offset_days,
    subject_name,
    status,
    attempts,
    last_error,
    created_at,
    sent_at: status === 'sent' ? created_at : null,
  }
}

interface State {
  tables: Tables
  userId: string | null
}

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as State
  } catch {
    // localStorage no disponible o datos corruptos: se usan los datos iniciales.
  }
  return { tables: seed(), userId: null }
}

let state = load()

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Sin persistencia: los datos viven solo en memoria.
  }
}

export function resetMockData() {
  state = { tables: seed(), userId: state.userId }
  persist()
  window.location.reload()
}

const wait = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), DELAY_MS))

function compare(a: unknown, b: unknown): number {
  // Como en Postgres (ASC): los null van al final.
  if (a === b) return 0
  if (a == null) return 1
  if (b == null) return -1
  return String(a).localeCompare(String(b), 'es')
}

/** Proyecta columnas: "id, name", "*" o relaciones del tipo "alias:tabla!fk(col1, col2)". */
function project(row: Row, columns: string): Row {
  if (columns.trim() === '*') return { ...row }
  const out: Row = {}
  const parts = columns.match(/[^,(]+(\([^)]*\))?/g) ?? []
  for (const part of parts.map((p) => p.trim()).filter(Boolean)) {
    const rel = part.match(/^(\w+):(\w+)(?:!\w+)?\(([^)]*)\)$/)
    if (rel) {
      const [, alias, table, cols] = rel
      const target = (state.tables[table] ?? []).find((r) => r.id === row[`${alias}_id`])
      out[alias] = target ? project(target, cols) : null
    } else {
      out[part] = row[part]
    }
  }
  return out
}

class MockQuery implements PromiseLike<Result> {
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select'
  private payload: Row = {}
  private columns: string | null = null
  private filters: [string, unknown][] = []
  private orders: { column: string; ascending: boolean }[] = []
  private max: number | null = null
  private mode: 'many' | 'maybe' | 'single' = 'many'

  constructor(private table: string) {}

  select(columns = '*') {
    this.columns = columns
    return this
  }
  insert(row: Row) {
    this.op = 'insert'
    this.payload = row
    return this
  }
  update(patch: Row) {
    this.op = 'update'
    this.payload = patch
    return this
  }
  delete() {
    this.op = 'delete'
    return this
  }
  eq(column: string, value: unknown) {
    this.filters.push([column, value])
    return this
  }
  order(column: string, opts?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: opts?.ascending ?? true })
    return this
  }
  limit(n: number) {
    this.max = n
    return this
  }
  maybeSingle() {
    this.mode = 'maybe'
    return this
  }
  single() {
    this.mode = 'single'
    return this
  }

  then<A = Result, B = never>(onOk?: ((r: Result) => A | PromiseLike<A>) | null, onErr?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return wait(this.run()).then(onOk, onErr)
  }

  private run(): Result {
    if (!state.userId) return { data: null, error: { message: 'permission denied (sin sesión)' } }
    const rows = (state.tables[this.table] ??= [])
    const matches = (r: Row) => this.filters.every(([c, v]) => r[c] === v)
    let affected: Row[]

    if (this.op === 'insert') {
      const row: Row = { id: crypto.randomUUID(), ...this.payload }
      // En la base de datos real student_id lo rellena auth.uid().
      if ((this.table === 'subjects' || this.table === 'exams') && !row.student_id) row.student_id = state.userId
      if (this.table === 'subjects' && rows.some((r) => r.student_id === row.student_id && r.name === row.name)) {
        return { data: null, error: { message: 'duplicate key value violates unique constraint "subjects_student_name_key"' } }
      }
      rows.push(row)
      affected = [row]
    } else if (this.op === 'update') {
      affected = rows.filter(matches)
      affected.forEach((r) => Object.assign(r, this.payload))
    } else if (this.op === 'delete') {
      affected = rows.filter(matches)
      state.tables[this.table] = rows.filter((r) => !matches(r))
    } else {
      affected = rows.filter(matches)
    }
    if (this.op !== 'select') persist()

    if (this.op !== 'select' && this.columns === null) return { data: null, error: null }
    let result = [...affected]
    for (const { column, ascending } of [...this.orders].reverse()) {
      result.sort((a, b) => compare(a[column], b[column]) * (ascending ? 1 : -1))
    }
    if (this.max !== null) result = result.slice(0, this.max)
    const data = result.map((r) => project(r, this.columns ?? '*'))

    if (this.mode === 'single') {
      return data.length === 1
        ? { data: data[0], error: null }
        : { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' } }
    }
    if (this.mode === 'maybe') return { data: data[0] ?? null, error: null }
    return { data, error: null }
  }
}

function sessionFor(userId: string | null) {
  const user = MOCK_USERS.find((u) => u.id === userId)
  if (!user) return null
  return {
    access_token: 'mock',
    refresh_token: 'mock',
    token_type: 'bearer',
    expires_in: 3600,
    user: { id: user.id, email: user.email, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '' },
  }
}

const listeners = new Set<(event: AuthEvent, session: ReturnType<typeof sessionFor>) => void>()

function setUser(userId: string | null, event: AuthEvent) {
  state.userId = userId
  persist()
  listeners.forEach((cb) => cb(event, sessionFor(userId)))
}

export function createMockClient() {
  return {
    from: (table: string) => new MockQuery(table),

    rpc: async (fn: string, args: Row) => {
      if (fn === 'delete_subject') {
        state.tables.exams = state.tables.exams.filter((e) => e.subject_id !== args.p_subject_id)
        state.tables.subjects = state.tables.subjects.filter((s) => s.id !== args.p_subject_id)
        persist()
        return wait({ data: null, error: null })
      }
      return wait({ data: null, error: { message: `RPC "${fn}" no implementada en el mock` } })
    },

    auth: {
      getSession: async () => ({ data: { session: sessionFor(state.userId) }, error: null }),

      onAuthStateChange(cb: (event: AuthEvent, session: ReturnType<typeof sessionFor>) => void) {
        listeners.add(cb)
        setTimeout(() => cb('INITIAL_SESSION', sessionFor(state.userId)), 0)
        return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } }
      },

      async signInWithPassword({ email }: { email: string; password: string }) {
        const user = MOCK_USERS.find((u) => u.email === email.toLowerCase())
        if (!user) return wait({ data: { user: null, session: null }, error: { message: 'Invalid login credentials' } })
        await wait(null)
        setUser(user.id, 'SIGNED_IN')
        return { data: sessionFor(user.id), error: null }
      },

      async signOut() {
        setUser(null, 'SIGNED_OUT')
        return { error: null }
      },

      resetPasswordForEmail: async () => wait({ data: {}, error: null }),

      updateUser: async () => wait({ data: { user: sessionFor(state.userId)?.user ?? null }, error: null }),
    },
  }
}
