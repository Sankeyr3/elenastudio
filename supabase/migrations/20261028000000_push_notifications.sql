-- Avisos por notificación push al móvil del ayudante, en lugar de por correo.
-- Cada dispositivo en el que el ayudante activa las notificaciones guarda aquí su suscripción
-- (Web Push). La tarea programada la usa para enviarle los avisos.

create table elenastudio.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  helper_id uuid not null default auth.uid() references elenastudio.profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 1 and 200),
  auth text not null check (char_length(auth) between 1 and 100),
  -- Descripción del dispositivo (navegador), solo para mostrarla en la app.
  device text check (device is null or char_length(device) <= 200),
  created_at timestamptz not null default now()
);
create index push_subscriptions_helper_idx on elenastudio.push_subscriptions (helper_id);

revoke all on elenastudio.push_subscriptions from anon, authenticated;
grant select, insert, delete on elenastudio.push_subscriptions to authenticated;
grant all on elenastudio.push_subscriptions to service_role;

alter table elenastudio.push_subscriptions enable row level security;

-- Solo el propio ayudante ve, añade y quita sus dispositivos.
create policy "push: ver propias" on elenastudio.push_subscriptions
  for select to authenticated
  using (helper_id = (select auth.uid()));
create policy "push: crear (ayudante)" on elenastudio.push_subscriptions
  for insert to authenticated
  with check (
    helper_id = (select auth.uid())
    and exists (select 1 from elenastudio.profiles p where p.id = (select auth.uid()) and p.role = 'helper')
  );
create policy "push: borrar propias" on elenastudio.push_subscriptions
  for delete to authenticated
  using (helper_id = (select auth.uid()));

-- Fuera el correo: ni dirección de destino ni identificador de Resend.
alter table elenastudio.reminder_settings drop column notify_email;
alter table elenastudio.reminder_log drop column email_id;

drop function elenastudio.finish_reminders(uuid[], boolean, text, text);
create function elenastudio.finish_reminders(p_ids uuid[], p_ok boolean, p_error text)
returns void
language sql
security invoker
set search_path = ''
as $$
  update elenastudio.reminder_log
  set status = case when p_ok then 'sent'::elenastudio.reminder_status else 'failed'::elenastudio.reminder_status end,
      attempts = attempts + 1,
      last_error = case when p_ok then null else left(p_error, 500) end,
      sent_at = case when p_ok then now() else sent_at end
  where id = any (p_ids);
$$;
revoke all on function elenastudio.finish_reminders(uuid[], boolean, text) from public, anon, authenticated;
grant execute on function elenastudio.finish_reminders(uuid[], boolean, text) to service_role;

-- Igual que antes, pero sin correo de destino. "create or replace" conserva los permisos (nadie de la app).
create or replace function elenastudio.setup_accounts(
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
  insert into elenastudio.reminder_settings (helper_id) values (v_helper)
  on conflict (helper_id) do nothing;

  return 'Cuentas configuradas: ' || p_student_name || ' (estudiante) y ' || p_helper_name || ' (ayudante).';
end;
$$;

notify pgrst, 'reload schema';
