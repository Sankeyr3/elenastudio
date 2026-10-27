// Prueba la migración SQL y las políticas RLS en un Postgres real (PGlite, en memoria).
// Se simula lo mínimo de Supabase: el esquema `auth`, `auth.uid()` y los roles anon/authenticated/service_role.
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'

const ELENA = '11111111-1111-1111-1111-111111111111'
const HELPER = '22222222-2222-2222-2222-222222222222'
const STRANGER = '33333333-3333-3333-3333-333333333333'
// Usuario de la otra aplicación que comparte el proyecto de Supabase (sin perfil en estudion).
const OTHER_APP = '44444444-4444-4444-4444-444444444444'

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text not null);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  -- Simula la otra aplicación que comparte el proyecto: ya tiene su propia tabla public.profiles.
  create table public.profiles (id uuid primary key, username text);
  -- Peor caso: privilegios por defecto amplios para todo lo que se cree; la migración debe restringirlos.
  alter default privileges grant all on tables to anon, authenticated, service_role;
  alter default privileges grant execute on functions to anon, authenticated, service_role;
  insert into auth.users values
    ('${ELENA}', 'elena@example.org'),
    ('${HELPER}', 'yo@example.org'),
    ('${STRANGER}', 'otra@example.org'),
    ('${OTHER_APP}', 'usuario-otra-app@example.org');
`

let db: PGlite

/** Ejecuta `sql` como un usuario concreto (o como anon si `uid` es null) dentro de una transacción. */
async function as<T = Record<string, unknown>>(uid: string | null, sql: string, params: unknown[] = []) {
  return db.transaction(async (tx) => {
    await tx.query(`set local role ${uid ? 'authenticated' : 'anon'}`)
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid ?? ''])
    const result = await tx.query<T>(sql, params)
    return result.rows
  })
}

async function asService<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  return db.transaction(async (tx) => {
    await tx.query('set local role service_role')
    return (await tx.query<T>(sql, params)).rows
  })
}

let historyId: string
let drawingId: string

beforeAll(async () => {
  db = new PGlite()
  await db.exec(SUPABASE_STUB)
  await db.exec(readFileSync('supabase/migrations/20261022000000_init.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/20261025000000_subject_color.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/20261026000000_subject_icon.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/20261027000000_subject_icon_colors.sql', 'utf8'))
  await db.query(`select estudion.setup_accounts('elena@example.org', 'YO@example.org', 'Elena', 'David')`)
})

describe('setup_accounts', () => {
  it('crea perfiles, vínculo y preferencias por defecto', async () => {
    const profiles = await db.query<{ role: string }>('select role from estudion.profiles order by role')
    expect(profiles.rows.map((r) => r.role)).toEqual(['student', 'helper'])
    const settings = await db.query<{ offsets: number[]; notify_email: string }>(
      'select offsets, notify_email from estudion.reminder_settings',
    )
    expect(settings.rows[0]).toEqual({ offsets: [14, 7, 3, 1], notify_email: 'yo@example.org' })
  })

  it('no la puede ejecutar ningún usuario de la app', async () => {
    await expect(as(ELENA, `select estudion.setup_accounts('elena@example.org', 'otra@example.org')`)).rejects.toThrow(
      /permission denied/,
    )
    await expect(asService(`select estudion.setup_accounts('elena@example.org', 'otra@example.org')`)).rejects.toThrow(
      /permission denied/,
    )
  })
})

describe('Elena (estudiante)', () => {
  it('crea asignaturas', async () => {
    const rows = await as<{ id: string }>(
      ELENA,
      `insert into estudion.subjects (name, difficulty, liking) values
         ('Historia', 5, 'poco'), ('Dibujo técnico', 1, 'mucho') returning id`,
    )
    ;[historyId, drawingId] = rows.map((r) => r.id)
    expect(rows).toHaveLength(2)
  })

  it('no puede repetir el nombre de una asignatura', async () => {
    await expect(as(ELENA, `insert into estudion.subjects (name, difficulty) values (' historia ', 3)`)).rejects.toThrow(
      /subjects_student_name_key/,
    )
  })

  it('valida la escala de dificultad', async () => {
    await expect(as(ELENA, `insert into estudion.subjects (name, difficulty) values ('Física', 6)`)).rejects.toThrow(
      /check/,
    )
  })

  it('guarda un icono dibujado y rechaza contenido que no sea un trazado válido', async () => {
    const updated = await as(ELENA, `update estudion.subjects set icon = 'M10 20L30 40M50 50L50 50' where id = $1 returning icon`, [
      historyId,
    ])
    expect(updated).toEqual([{ icon: 'M10 20L30 40M50 50L50 50' }])
    const multicolor = '#e11d48M10 20L30 40#000000M50 50L50 50cM1 1L2 2'
    const colored = await as(ELENA, `update estudion.subjects set icon = $2 where id = $1 returning icon`, [historyId, multicolor])
    expect(colored).toEqual([{ icon: multicolor }])
    await expect(
      as(ELENA, `update estudion.subjects set icon = '"/><script>alert(1)</script>' where id = $1`, [historyId]),
    ).rejects.toThrow(/check/)
  })

  it('crea varios exámenes el mismo día, edita y borra', async () => {
    const rows = await as<{ id: string }>(
      ELENA,
      `insert into estudion.exams (subject_id, exam_date, exam_time, note) values
         ($1, '2026-11-10', '09:00', 'Temas 1-4'), ($2, '2026-11-10', null, null), ($2, '2026-11-20', null, null)
       returning id`,
      [historyId, drawingId],
    )
    expect(rows).toHaveLength(3)

    const updated = await as(ELENA, `update estudion.exams set note = 'Temas 1-5' where id = $1 returning note`, [
      rows[0].id,
    ])
    expect(updated).toEqual([{ note: 'Temas 1-5' }])

    const deleted = await as(ELENA, `delete from estudion.exams where id = $1 returning id`, [rows[2].id])
    expect(deleted).toHaveLength(1)
  })

  it('no puede crear datos a nombre de otra persona', async () => {
    await expect(
      as(ELENA, `insert into estudion.subjects (student_id, name, difficulty) values ($1, 'Inglés', 2)`, [HELPER]),
    ).rejects.toThrow(/row-level security/)
  })

  it('no puede usar una asignatura de otra estudiante', async () => {
    await db.query(`insert into estudion.profiles values ($1, 'student', 'Otra')`, [STRANGER])
    const [other] = await as<{ id: string }>(
      STRANGER,
      `insert into estudion.subjects (name, difficulty) values ('Latín', 3) returning id`,
    )
    await expect(
      as(ELENA, `insert into estudion.exams (subject_id, exam_date) values ($1, '2026-11-11')`, [other.id]),
    ).rejects.toThrow(/foreign key/)
  })

  it('no ve las preferencias ni el registro de avisos del ayudante', async () => {
    expect(await as(ELENA, 'select * from estudion.reminder_settings')).toEqual([])
    expect(await as(ELENA, 'select * from estudion.reminder_log')).toEqual([])
  })

  it('no puede escribir en el registro de avisos ni reservar envíos', async () => {
    await expect(
      as(ELENA, `insert into estudion.reminder_log (helper_id, exam_date, offset_days, subject_name)
                 values ($1, '2026-11-10', 7, 'x')`, [HELPER]),
    ).rejects.toThrow(/permission denied/)
    await expect(as(ELENA, `select estudion.claim_reminders('[]'::jsonb)`)).rejects.toThrow(/permission denied/)
  })

  it('borrar una asignatura con exámenes directamente falla; con delete_subject se borran ambos', async () => {
    await expect(as(ELENA, 'delete from estudion.subjects where id = $1', [historyId])).rejects.toThrow(/foreign key/)

    const [{ id: tmp }] = await as<{ id: string }>(
      ELENA,
      `insert into estudion.subjects (name, difficulty) values ('Química', 4) returning id`,
    )
    await as(ELENA, `insert into estudion.exams (subject_id, exam_date) values ($1, '2026-12-01')`, [tmp])
    await as(ELENA, 'select estudion.delete_subject($1)', [tmp])
    expect(await as(ELENA, 'select id from estudion.subjects where id = $1', [tmp])).toEqual([])
    expect(await as(ELENA, 'select id from estudion.exams where subject_id = $1', [tmp])).toEqual([])
  })
})

describe('Ayudante (solo lectura)', () => {
  it('ve los exámenes, asignaturas y el perfil de Elena', async () => {
    expect(await as(HELPER, 'select name from estudion.subjects order by name')).toEqual([
      { name: 'Dibujo técnico' },
      { name: 'Historia' },
    ])
    expect(await as(HELPER, 'select id from estudion.exams')).toHaveLength(2)
    expect(await as(HELPER, `select display_name from estudion.profiles order by display_name`)).toEqual([
      { display_name: 'David' },
      { display_name: 'Elena' },
    ])
  })

  it('no ve datos de estudiantes no vinculadas', async () => {
    expect(await as(HELPER, `select id from estudion.subjects where name = 'Latín'`)).toEqual([])
  })

  it('no puede crear, editar ni borrar asignaturas o exámenes', async () => {
    await expect(
      as(HELPER, `insert into estudion.subjects (student_id, name, difficulty) values ($1, 'Inglés', 2)`, [ELENA]),
    ).rejects.toThrow(/row-level security/)
    await expect(
      as(HELPER, `insert into estudion.exams (student_id, subject_id, exam_date) values ($1, $2, '2026-11-12')`, [
        ELENA,
        historyId,
      ]),
    ).rejects.toThrow(/row-level security/)
    expect(await as(HELPER, `update estudion.subjects set difficulty = 1 returning id`)).toEqual([])
    expect(await as(HELPER, `update estudion.exams set note = 'hack' returning id`)).toEqual([])
    expect(await as(HELPER, `delete from estudion.exams returning id`)).toEqual([])
    await expect(as(HELPER, 'select estudion.delete_subject($1)', [historyId])).rejects.toThrow(/no encontrada/)
    const [{ difficulty }] = await db.query<{ difficulty: number }>(
      'select difficulty from estudion.subjects where id = $1',
      [historyId],
    ).then((r) => r.rows)
    expect(difficulty).toBe(5)
  })

  it('puede editar sus preferencias de avisos, con validación', async () => {
    const rows = await as(
      HELPER,
      `update estudion.reminder_settings set offsets = '{10,5,2}', hard_extra_days = 4 returning offsets`,
    )
    expect(rows).toEqual([{ offsets: [10, 5, 2] }])
    await expect(as(HELPER, `update estudion.reminder_settings set offsets = '{}'`)).rejects.toThrow(/check/)
    await expect(as(HELPER, `update estudion.reminder_settings set offsets = '{200}'`)).rejects.toThrow(/check/)
    await expect(as(HELPER, `update estudion.reminder_settings set helper_id = $1`, [ELENA])).rejects.toThrow(
      /permission denied/,
    )
  })

  it('no puede cambiar su rol ni el vínculo', async () => {
    await expect(as(HELPER, `update estudion.profiles set role = 'student'`)).rejects.toThrow(/permission denied/)
    await expect(
      as(HELPER, `insert into estudion.helper_links values ($1, $2)`, [STRANGER, HELPER]),
    ).rejects.toThrow(/permission denied/)
  })
})

describe('Usuario de la otra aplicación del proyecto', () => {
  it('no ve nada ni puede crear datos en estudion', async () => {
    for (const table of ['profiles', 'helper_links', 'subjects', 'exams', 'reminder_settings', 'reminder_log']) {
      expect(await as(OTHER_APP, `select * from estudion.${table}`)).toEqual([])
    }
    await expect(
      as(OTHER_APP, `insert into estudion.subjects (name, difficulty) values ('Spam', 1)`),
    ).rejects.toThrow(/row-level security/)
    expect(await as(OTHER_APP, `update estudion.exams set note = 'x' returning id`)).toEqual([])
    await expect(as(OTHER_APP, `select estudion.claim_reminders('[]'::jsonb)`)).rejects.toThrow(/permission denied/)
  })

  it('las tablas de la otra aplicación en public no se tocan', async () => {
    expect((await db.query('select count(*)::int as n from public.profiles')).rows).toEqual([{ n: 0 }])
  })
})

describe('Visitante no autenticado', () => {
  it('no puede leer ni escribir nada', async () => {
    for (const table of ['profiles', 'helper_links', 'subjects', 'exams', 'reminder_settings', 'reminder_log']) {
      await expect(as(null, `select * from estudion.${table}`)).rejects.toThrow(/permission denied/)
    }
    await expect(as(null, `select estudion.claim_reminders('[]'::jsonb)`)).rejects.toThrow(/permission denied/)
    await expect(as(null, `select estudion.delete_subject($1)`, [historyId])).rejects.toThrow(/permission denied/)
  })
})

describe('Reserva de avisos (sin duplicados)', () => {
  const item = () => [{ helper_id: HELPER, exam_id: examId, exam_date: '2026-11-10', offset_days: 7, subject_name: 'Historia' }]
  let examId: string

  beforeAll(async () => {
    examId = (await db.query<{ id: string }>(`select id from estudion.exams where note = 'Temas 1-5'`)).rows[0].id
  })

  it('un aviso solo se reserva una vez', async () => {
    const first = await asService<{ id: string }>('select * from estudion.claim_reminders($1)', [JSON.stringify(item())])
    expect(first).toHaveLength(1)
    const second = await asService('select * from estudion.claim_reminders($1)', [JSON.stringify(item())])
    expect(second).toEqual([])

    await asService('select estudion.finish_reminders($1, true, null, $2)', [[first[0].id], 'email_123'])
    const third = await asService('select * from estudion.claim_reminders($1)', [JSON.stringify(item())])
    expect(third).toEqual([])
    const [log] = await as<{ status: string; attempts: number }>(HELPER, 'select status, attempts from estudion.reminder_log')
    expect(log).toMatchObject({ status: 'sent', attempts: 1 })
  })

  it('un aviso fallido se reintenta, hasta 5 intentos', async () => {
    const other = [{ ...item()[0], offset_days: 3 }]
    let claimed = await asService<{ id: string }>('select * from estudion.claim_reminders($1)', [JSON.stringify(other)])
    for (let attempt = 1; attempt <= 5; attempt++) {
      expect(claimed).toHaveLength(1)
      await asService('select estudion.finish_reminders($1, false, $2, null)', [[claimed[0].id], 'Error de prueba'])
      claimed = await asService('select * from estudion.claim_reminders($1)', [JSON.stringify(other)])
    }
    expect(claimed).toEqual([])
  })

  it('si cambia la fecha del examen, los avisos vuelven a aplicarse', async () => {
    const moved = [{ ...item()[0], exam_date: '2026-11-17' }]
    expect(await asService('select * from estudion.claim_reminders($1)', [JSON.stringify(moved)])).toHaveLength(1)
  })

  it('al borrar el examen se conserva el historial', async () => {
    await as(ELENA, 'delete from estudion.exams where id = $1', [examId])
    const logs = await as<{ exam_id: string | null }>(HELPER, 'select exam_id from estudion.reminder_log')
    expect(logs.length).toBeGreaterThan(0)
    expect(logs.every((l) => l.exam_id === null)).toBe(true)
  })
})
