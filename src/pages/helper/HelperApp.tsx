import { useCallback, useEffect, useMemo, useState } from 'react'
import { daysBetween, formatDate, formatTime, relativeDays } from '../../../shared/dates'
import {
  DEFAULT_HARD_EXTRA_DAYS,
  DEFAULT_OFFSETS,
  needsAttention,
  nextReminder,
  offsetsForExam,
  shouldStudyToday,
  type PlannedReminder,
} from '../../../shared/reminders'
import { ExamList } from '../../components/ExamList'
import { ExamsBrowser } from '../../components/ExamsBrowser'
import { Alert, DifficultyBadge, EmptyState, Heading, LikingText, Loading, SubjectDot } from '../../components/ui'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import type { ExamWithSubject, Profile, ReminderLog, ReminderSettings } from '../../lib/types'
import { useStudentData } from '../../lib/useStudentData'
import { PushSetup } from './PushSetup'
import { ReminderLogList } from './ReminderLogList'
import { SettingsForm } from './SettingsForm'

export type HelperTab = 'resumen' | 'avisos'

export function HelperApp({ profile, tab }: { profile: Profile; tab: HelperTab }) {
  const [student, setStudent] = useState<Profile | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase
        .from('helper_links')
        .select('student:profiles!helper_links_student_id_fkey(id, role, display_name)')
        .eq('helper_id', profile.id)
        .limit(1)
        .maybeSingle()
      if (error) return setError(friendlyError(error))
      setStudent((data?.student as unknown as Profile | undefined) ?? null)
    })()
  }, [profile.id])

  if (error) return <Alert>{error}</Alert>
  if (student === undefined) return <Loading />
  if (student === null)
    return (
      <EmptyState title="tu cuenta todavía no está vinculada">
        <p>Ejecuta la función setup_accounts en Supabase (ver README, paso 9).</p>
      </EmptyState>
    )
  return <HelperDashboard helperId={profile.id} student={student} tab={tab} />
}

function HelperDashboard({ helperId, student, tab }: { helperId: string; student: Profile; tab: HelperTab }) {
  const data = useStudentData(student.id)
  const [settings, setSettings] = useState<ReminderSettings | null>(null)
  const [logs, setLogs] = useState<ReminderLog[]>([])
  const [deviceCount, setDeviceCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadReminders = useCallback(async () => {
    const [settingsRes, logsRes, devicesRes] = await Promise.all([
      supabase.from('reminder_settings').select('*').eq('helper_id', helperId).maybeSingle(),
      supabase.from('reminder_log').select('*').eq('helper_id', helperId).order('created_at', { ascending: false }).limit(100),
      supabase.from('push_subscriptions').select('id').eq('helper_id', helperId),
    ])
    if (settingsRes.error || logsRes.error || devicesRes.error)
      setError(friendlyError(settingsRes.error ?? logsRes.error ?? devicesRes.error))
    else {
      setSettings(settingsRes.data as ReminderSettings | null)
      setLogs(logsRes.data as ReminderLog[])
      setDeviceCount(devicesRes.data.length)
    }
    setLoading(false)
  }, [helperId])

  useEffect(() => {
    void loadReminders()
  }, [loadReminders])

  const planned = useMemo(() => {
    if (!settings) return []
    const sent = new Map<string, Set<number>>()
    for (const l of logs) {
      if (!l.exam_id || l.status === 'failed') continue
      const key = `${l.exam_id}:${l.exam_date}`
      sent.set(key, (sent.get(key) ?? new Set()).add(l.offset_days))
    }
    return data.upcoming
      .flatMap((exam): { exam: ExamWithSubject; reminder: PlannedReminder }[] => {
        const reminder = nextReminder(
          exam.exam_date,
          daysBetween(data.today, exam.exam_date),
          offsetsForExam(exam.subject.difficulty, settings),
          sent.get(`${exam.id}:${exam.exam_date}`) ?? new Set(),
          data.today,
        )
        return reminder ? [{ exam, reminder }] : []
      })
      .sort((a, b) => a.reminder.date.localeCompare(b.reminder.date))
  }, [settings, logs, data.upcoming, data.today])

  if (data.loading || loading) return <Loading />
  const anyError = error ?? data.error
  const name = student.display_name

  if (tab === 'avisos') {
    return (
      <div className="space-y-4">
        {anyError && <Alert>{anyError}</Alert>}
        <section>
          <Heading as="h1">avisos</Heading>
          <p className="mb-2 text-muted">
            te llegará una notificación al móvil cuando toque avisar a {name} de un examen.
          </p>
          <PushSetup onDevicesChange={setDeviceCount} />
        </section>
        <section>
          <Heading>cuándo avisar</Heading>
          {settings ? (
            <SettingsForm settings={settings} onSaved={setSettings} />
          ) : (
            <Alert tone="info">No hay preferencias de avisos. Ejecuta setup_accounts en Supabase (README, paso 9).</Alert>
          )}
        </section>
        <section>
          <Heading>historial de envíos</Heading>
          <ReminderLogList logs={logs} empty="aún no se ha enviado ningún aviso." />
        </section>
      </div>
    )
  }

  const attention = data.upcoming.filter((e) => needsAttention(daysBetween(data.today, e.exam_date), e.subject.difficulty))
  const hardest = [...data.subjects].sort((a, b) => b.difficulty - a.difficulty || a.name.localeCompare(b.name, 'es'))
  const nextWeekCount = data.upcoming.filter((e) => daysBetween(data.today, e.exam_date) <= 7).length
  const rules = settings ?? { offsets: DEFAULT_OFFSETS, hard_extra_days: DEFAULT_HARD_EXTRA_DAYS }
  const examsToday = data.upcoming.filter((e) => e.exam_date === data.today)
  // Una fila por asignatura (su examen más cercano), lo más urgente primero.
  const studyToday = [
    ...new Map(
      data.upcoming
        .filter((e) => shouldStudyToday(daysBetween(data.today, e.exam_date), e.subject.difficulty, rules))
        .reverse()
        .map((e) => [e.subject.id, e]),
    ).values(),
  ].sort((a, b) => a.exam_date.localeCompare(b.exam_date) || b.subject.difficulty - a.subject.difficulty)

  return (
    <div className="space-y-4">
      <div>
        <Heading as="h1">exámenes de {name}</Heading>
        <p className="text-muted">
          {data.upcoming.length === 0
            ? 'no tiene exámenes próximos.'
            : `${data.upcoming.length} próximos · ${nextWeekCount} en los próximos 7 días`}
        </p>
      </div>
      {anyError && <Alert>{anyError}</Alert>}
      {settings && !settings.enabled && <Alert tone="info">los avisos están desactivados (pestaña [avisos]).</Alert>}
      {settings?.enabled && deviceCount === 0 && (
        <Alert tone="info">aún no has activado las notificaciones en tu móvil: pestaña [avisos] → «activar notificaciones aquí».</Alert>
      )}

      <section className="border-2 border-ink p-2">
        <Heading>hoy debe estudiar</Heading>
        {studyToday.length ? (
          <ul className="space-y-1">
            {studyToday.map((exam) => {
              const daysLeft = daysBetween(data.today, exam.exam_date)
              return (
                <li key={exam.subject.id} className="flex items-center gap-2 px-1 py-1">
                  <SubjectDot subject={exam.subject} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lg font-bold">{exam.subject.name}</span>
                    <span className="block text-muted">
                      examen {formatDate(exam.exam_date)}
                      {exam.exam_time && ` · ${formatTime(exam.exam_time)}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className={`block ${daysLeft <= 3 ? 'font-bold text-red-700' : ''}`}>
                      {relativeDays(daysLeft).toLowerCase()}
                    </span>
                    <DifficultyBadge difficulty={exam.subject.difficulty} />
                  </span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-muted">hoy no tiene que estudiar nada concreto.</p>
        )}
        {examsToday.length > 0 && (
          <p className="mt-2 border-t border-dashed border-line pt-1">
            <span className="font-bold">hoy tiene examen de:</span>{' '}
            {examsToday.map((e) => e.subject.name + (e.exam_time ? ` (${formatTime(e.exam_time)})` : '')).join(', ')}
          </p>
        )}
        <p className="mt-1 text-xs text-muted">
          asignaturas con examen dentro de los plazos de aviso ({offsetsForExam(1, rules)[0] ?? 0} días, o{' '}
          {offsetsForExam(5, rules)[0] ?? 0} si es difícil).
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section>
          <Heading>requieren atención</Heading>
          <p className="mb-1 text-xs text-muted">en 3 días o menos, o difíciles (4–5) en 14 días o menos.</p>
          {attention.length ? <ExamList exams={attention} today={data.today} /> : <p className="text-muted">nada urgente.</p>}
        </section>

        <div className="space-y-4">
          <section>
            <Heading>próximos recordatorios</Heading>
            {planned.length ? (
              <ul>
                {planned.slice(0, 8).map(({ exam, reminder }) => (
                  <li key={exam.id} className="flex items-center gap-2 px-1">
                    <SubjectDot subject={exam.subject} />
                    <span className="min-w-0 flex-1 truncate">
                      {exam.subject.name} <span className="text-muted">{formatDate(exam.exam_date)} · -{reminder.offset}d</span>
                    </span>
                    <span className={`shrink-0 ${reminder.dueNow ? 'font-bold' : 'text-muted'}`}>
                      {reminder.dueNow ? 'próximo envío' : formatDate(reminder.date)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">no hay recordatorios programados.</p>
            )}
            <p className="mt-1 text-xs text-muted">se envían una vez al día, por la tarde (hacia las 17:00, hora de madrid).</p>
          </section>

          <section>
            <Heading>lo que más le cuesta</Heading>
            {hardest.length ? (
              <ul>
                {hardest.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 px-1">
                    <SubjectDot subject={s} />
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    <LikingText liking={s.liking} />
                    <DifficultyBadge difficulty={s.difficulty} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">{name} aún no ha añadido asignaturas.</p>
            )}
          </section>
        </div>
      </div>

      <section>
        <Heading>últimos envíos</Heading>
        <ReminderLogList logs={logs.slice(0, 5)} empty="aún no se ha enviado ningún aviso." />
      </section>

      <section>
        <Heading>todos los exámenes</Heading>
        {data.exams.length ? (
          <ExamsBrowser upcoming={data.upcoming} all={data.exams} today={data.today} />
        ) : (
          <EmptyState title={`${name} aún no ha añadido exámenes`}>
            <p>cuando lo haga, aparecerán aquí y empezarás a recibir los avisos.</p>
          </EmptyState>
        )}
      </section>
    </div>
  )
}
