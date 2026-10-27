-- ElenaStudio: esquema inicial.
-- Ejecuta este archivo completo una sola vez en Supabase > SQL Editor.
--
-- Todo vive en un esquema propio, "elenastudio", para poder compartir el proyecto de Supabase
-- con otra aplicación sin chocar con sus tablas de "public". Después hay que añadir
-- "elenastudio" a los esquemas expuestos de la Data API (ver README, paso 4).

create schema elenastudio;

-- Sin USAGE para anon: los visitantes no autenticados no pueden ni ver que el esquema existe.
revoke all on schema elenastudio from public, anon;
grant usage on schema elenastudio to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type elenastudio.user_role as enum ('student', 'helper');
create type elenastudio.liking as enum ('mucho', 'regular', 'poco');
create type elenastudio.reminder_status as enum ('sending', 'sent', 'failed');

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

-- Perfil y rol de cada cuenta (las cuentas se crean en Supabase Auth).
create table elenastudio.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role elenastudio.user_role not null,
  display_name text not null check (char_length(display_name) between 1 and 60),
  created_at timestamptz not null default now()
);

-- Relación autorizada: qué ayudante puede ver los datos de qué estudiante.
create table elenastudio.helper_links (
  student_id uuid not null references elenastudio.profiles (id) on delete cascade,
  helper_id uuid not null references elenastudio.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, helper_id),
  check (student_id <> helper_id)
);

create table elenastudio.subjects (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null default auth.uid() references elenastudio.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  -- 1 = le cuesta muy poco ... 5 = le cuesta muchísimo
  difficulty smallint not null check (difficulty between 1 and 5),
  liking elenastudio.liking,
  created_at timestamptz not null default now(),
  unique (id, student_id)
);
create unique index subjects_student_name_key on elenastudio.subjects (student_id, lower(btrim(name)));

create table elenastudio.exams (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null default auth.uid() references elenastudio.profiles (id) on delete cascade,
  subject_id uuid not null,
  exam_date date not null check (exam_date between '2020-01-01' and '2100-12-31'),
  exam_time time,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  -- La asignatura debe pertenecer a la misma estudiante. "restrict" evita borrar
  -- una asignatura con exámenes por accidente (ver elenastudio.delete_subject).
  foreign key (subject_id, student_id) references elenastudio.subjects (id, student_id) on delete restrict
);
create index exams_student_date_idx on elenastudio.exams (student_id, exam_date);
create index exams_subject_idx on elenastudio.exams (subject_id);

create table elenastudio.reminder_settings (
  helper_id uuid primary key references elenastudio.profiles (id) on delete cascade,
  enabled boolean not null default true,
  notify_email text not null check (notify_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- Días antes del examen en los que se avisa.
  offsets integer[] not null default '{14,7,3,1}' check (
    cardinality(offsets) between 1 and 6
    and array_position(offsets, null) is null
    and 0 <= all (offsets)
    and 90 >= all (offsets)
  ),
  -- Días extra de antelación para asignaturas con dificultad 4 o 5.
  hard_extra_days integer not null default 7 check (hard_extra_days between 0 and 30),
  updated_at timestamptz not null default now()
);

-- Un registro por aviso (examen + fecha del examen + plazo). La restricción única
-- impide enviar el mismo aviso dos veces, incluso si el cron se ejecuta en paralelo.
create table elenastudio.reminder_log (
  id uuid primary key default gen_random_uuid(),
  helper_id uuid not null references elenastudio.profiles (id) on delete cascade,
  -- Si se borra el examen, el historial se conserva (con el nombre de la asignatura copiado).
  exam_id uuid references elenastudio.exams (id) on delete set null,
  exam_date date not null,
  offset_days integer not null,
  subject_name text not null,
  status elenastudio.reminder_status not null default 'sending',
  attempts integer not null default 0,
  last_error text,
  email_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (helper_id, exam_id, exam_date, offset_days)
);
create index reminder_log_helper_created_idx on elenastudio.reminder_log (helper_id, created_at desc);
create index reminder_log_exam_idx on elenastudio.reminder_log (exam_id);

-- ---------------------------------------------------------------------------
-- Permisos (además de RLS). Los visitantes anónimos no tienen acceso a nada.
-- Las cuentas de la otra aplicación del proyecto son "authenticated", pero sin perfil
-- en elenastudio.profiles las políticas RLS no les dejan ver ni crear nada.
-- ---------------------------------------------------------------------------
revoke all on elenastudio.profiles, elenastudio.helper_links, elenastudio.subjects, elenastudio.exams,
  elenastudio.reminder_settings, elenastudio.reminder_log from anon, authenticated;

grant select on elenastudio.profiles, elenastudio.helper_links, elenastudio.reminder_log to authenticated;
grant select, insert, update, delete on elenastudio.subjects, elenastudio.exams to authenticated;
grant select on elenastudio.reminder_settings to authenticated;
grant update (enabled, notify_email, offsets, hard_extra_days, updated_at) on elenastudio.reminder_settings to authenticated;

grant all on elenastudio.profiles, elenastudio.helper_links, elenastudio.subjects, elenastudio.exams,
  elenastudio.reminder_settings, elenastudio.reminder_log to service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table elenastudio.profiles enable row level security;
alter table elenastudio.helper_links enable row level security;
alter table elenastudio.subjects enable row level security;
alter table elenastudio.exams enable row level security;
alter table elenastudio.reminder_settings enable row level security;
alter table elenastudio.reminder_log enable row level security;

-- helper_links: cada parte ve su propia relación. Nadie la modifica desde la app.
create policy "links: ver propias" on elenastudio.helper_links
  for select to authenticated
  using (student_id = (select auth.uid()) or helper_id = (select auth.uid()));

-- profiles: el propio perfil y, para el ayudante, el de su estudiante.
create policy "profiles: ver propio o vinculado" on elenastudio.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from elenastudio.helper_links l
      where l.helper_id = (select auth.uid()) and l.student_id = profiles.id
    )
  );

-- subjects: la estudiante gestiona las suyas; el ayudante vinculado solo las lee.
create policy "subjects: leer" on elenastudio.subjects
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or exists (
      select 1 from elenastudio.helper_links l
      where l.helper_id = (select auth.uid()) and l.student_id = subjects.student_id
    )
  );
create policy "subjects: crear (estudiante)" on elenastudio.subjects
  for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and exists (select 1 from elenastudio.profiles p where p.id = (select auth.uid()) and p.role = 'student')
  );
create policy "subjects: editar (estudiante)" on elenastudio.subjects
  for update to authenticated
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));
create policy "subjects: borrar (estudiante)" on elenastudio.subjects
  for delete to authenticated
  using (student_id = (select auth.uid()));

-- exams: igual que subjects.
create policy "exams: leer" on elenastudio.exams
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or exists (
      select 1 from elenastudio.helper_links l
      where l.helper_id = (select auth.uid()) and l.student_id = exams.student_id
    )
  );
create policy "exams: crear (estudiante)" on elenastudio.exams
  for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and exists (select 1 from elenastudio.profiles p where p.id = (select auth.uid()) and p.role = 'student')
  );
create policy "exams: editar (estudiante)" on elenastudio.exams
  for update to authenticated
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));
create policy "exams: borrar (estudiante)" on elenastudio.exams
  for delete to authenticated
  using (student_id = (select auth.uid()));

-- reminder_settings: solo el propio ayudante (lectura y edición de columnas permitidas).
create policy "settings: leer propias" on elenastudio.reminder_settings
  for select to authenticated
  using (helper_id = (select auth.uid()));
create policy "settings: editar propias" on elenastudio.reminder_settings
  for update to authenticated
  using (helper_id = (select auth.uid()))
  with check (helper_id = (select auth.uid()));

-- reminder_log: solo lectura para el ayudante. Lo escribe la tarea programada (service_role).
create policy "log: leer propio" on elenastudio.reminder_log
  for select to authenticated
  using (helper_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Funciones
-- ---------------------------------------------------------------------------

-- Borra una asignatura junto con sus exámenes, en una sola transacción.
-- "security invoker": se aplican las políticas RLS de quien la llama,
-- así que solo la estudiante propietaria puede borrar algo.
create function elenastudio.delete_subject(p_subject_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from elenastudio.exams where subject_id = p_subject_id;
  delete from elenastudio.subjects where id = p_subject_id;
  if not found then
    raise exception 'Asignatura no encontrada o sin permiso' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function elenastudio.delete_subject(uuid) from public, anon;
grant execute on function elenastudio.delete_subject(uuid) to authenticated;

-- Reserva los avisos que se van a enviar. Devuelve solo los que esta ejecución debe enviar:
--   * avisos nuevos (los ya existentes se ignoran gracias a la restricción única), y
--   * avisos que fallaron antes (máximo 5 intentos).
-- Los avisos ya enviados o en curso nunca se devuelven, así que no se duplican.
create function elenastudio.claim_reminders(p_items jsonb)
returns setof elenastudio.reminder_log
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return query
  update elenastudio.reminder_log r
  set status = 'sending', last_error = null
  from jsonb_to_recordset(p_items) as i(helper_id uuid, exam_id uuid, exam_date date, offset_days integer, subject_name text)
  where r.helper_id = i.helper_id
    and r.exam_id = i.exam_id
    and r.exam_date = i.exam_date
    and r.offset_days = i.offset_days
    and r.status = 'failed'
    and r.attempts < 5
  returning r.*;

  return query
  insert into elenastudio.reminder_log as r (helper_id, exam_id, exam_date, offset_days, subject_name)
  select i.helper_id, i.exam_id, i.exam_date, i.offset_days, i.subject_name
  from jsonb_to_recordset(p_items) as i(helper_id uuid, exam_id uuid, exam_date date, offset_days integer, subject_name text)
  on conflict (helper_id, exam_id, exam_date, offset_days) do nothing
  returning r.*;
end;
$$;

-- Marca el resultado de un envío.
create function elenastudio.finish_reminders(p_ids uuid[], p_ok boolean, p_error text, p_email_id text)
returns void
language sql
security invoker
set search_path = ''
as $$
  update elenastudio.reminder_log
  set status = case when p_ok then 'sent'::elenastudio.reminder_status else 'failed'::elenastudio.reminder_status end,
      attempts = attempts + 1,
      last_error = case when p_ok then null else left(p_error, 500) end,
      email_id = p_email_id,
      sent_at = case when p_ok then now() else sent_at end
  where id = any (p_ids);
$$;

revoke all on function elenastudio.claim_reminders(jsonb) from public, anon, authenticated;
revoke all on function elenastudio.finish_reminders(uuid[], boolean, text, text) from public, anon, authenticated;
grant execute on function elenastudio.claim_reminders(jsonb) to service_role;
grant execute on function elenastudio.finish_reminders(uuid[], boolean, text, text) to service_role;

-- Configura las dos cuentas una vez creadas en Authentication > Users.
-- Solo se puede ejecutar desde el SQL Editor (no está disponible para la app).
create function elenastudio.setup_accounts(
  p_student_email text,
  p_helper_email text,
  p_student_name text default 'Elena',
  p_helper_name text default 'Ayudante'
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_student uuid;
  v_helper uuid;
begin
  select id into v_student from auth.users where lower(email) = lower(btrim(p_student_email));
  if v_student is null then
    raise exception 'No existe ningún usuario con el correo %. Créalo primero en Authentication > Users.', p_student_email;
  end if;
  select id into v_helper from auth.users where lower(email) = lower(btrim(p_helper_email));
  if v_helper is null then
    raise exception 'No existe ningún usuario con el correo %. Créalo primero en Authentication > Users.', p_helper_email;
  end if;
  if v_student = v_helper then
    raise exception 'Las dos cuentas deben ser distintas.';
  end if;

  insert into elenastudio.profiles (id, role, display_name) values (v_student, 'student', p_student_name)
  on conflict (id) do update set role = excluded.role, display_name = excluded.display_name;
  insert into elenastudio.profiles (id, role, display_name) values (v_helper, 'helper', p_helper_name)
  on conflict (id) do update set role = excluded.role, display_name = excluded.display_name;

  insert into elenastudio.helper_links (student_id, helper_id) values (v_student, v_helper)
  on conflict do nothing;
  insert into elenastudio.reminder_settings (helper_id, notify_email) values (v_helper, lower(btrim(p_helper_email)))
  on conflict (helper_id) do nothing;

  return 'Cuentas configuradas: ' || p_student_name || ' (estudiante) y ' || p_helper_name || ' (ayudante).';
end;
$$;
revoke all on function elenastudio.setup_accounts(text, text, text, text) from public, anon, authenticated, service_role;

-- Recarga la caché de la Data API para que vea el esquema nuevo.
notify pgrst, 'reload schema';
