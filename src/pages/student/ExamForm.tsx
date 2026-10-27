import { useState, type FormEvent } from 'react'
import { addDays, formatDate, isValidIsoDate, weekdayName } from '../../../shared/dates'
import { Alert, Button, Field, Modal, SubjectDot, inputClass, linkClass } from '../../components/ui'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import type { ExamWithSubject, Subject } from '../../lib/types'
import { MAX_NOTE_LENGTH, validateExam, type ExamErrors, type ExamInput } from '../../lib/validation'

export function ExamForm({
  subjects,
  exam,
  initialDate,
  today,
  onClose,
  onSaved,
}: {
  subjects: Subject[]
  exam: ExamWithSubject | null
  /** Fecha ya elegida (al pulsar un día del calendario). */
  initialDate?: string
  today: string
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [values, setValues] = useState<ExamInput>({
    subject_id: exam?.subject_id ?? (subjects.length === 1 ? subjects[0].id : ''),
    exam_date: exam?.exam_date ?? initialDate ?? '',
    exam_time: exam?.exam_time?.slice(0, 5) ?? '',
    note: exam?.note ?? '',
  })
  const [errors, setErrors] = useState<ExamErrors>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [showNote, setShowNote] = useState(Boolean(exam?.note))

  const set = (patch: Partial<ExamInput>) => setValues((v) => ({ ...v, ...patch }))

  async function save(addAnother: boolean) {
    const found = validateExam(values, today, exam?.exam_date)
    setErrors(found)
    if (Object.keys(found).length) return
    setSaving(true)
    setServerError(null)
    const row = {
      subject_id: values.subject_id,
      exam_date: values.exam_date,
      exam_time: values.exam_time || null,
      note: values.note.trim() || null,
    }
    const { error } = exam
      ? await supabase.from('exams').update(row).eq('id', exam.id)
      : await supabase.from('exams').insert(row)
    setSaving(false)
    if (error) return setServerError(friendlyError(error))
    await onSaved()
    if (addAnother) {
      const subject = subjects.find((s) => s.id === values.subject_id)
      setSavedMessage(`Guardado: ${subject?.name} el ${formatDate(values.exam_date)}. Añade el siguiente.`)
      // Se mantiene la fecha para registrar rápido varios exámenes el mismo día.
      setValues((v) => ({ ...v, subject_id: '', exam_time: '', note: '' }))
      setShowNote(false)
    } else {
      onClose()
    }
  }

  async function remove() {
    if (!exam) return
    setDeleting(true)
    const { error } = await supabase.from('exams').delete().eq('id', exam.id)
    setDeleting(false)
    if (error) return setServerError(friendlyError(error))
    await onSaved()
    onClose()
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void save(false)
  }

  const quickDates = [
    { label: 'mañana', date: addDays(today, 1) },
    { label: '+1 sem', date: addDays(today, 7) },
    { label: '+2 sem', date: addDays(today, 14) },
  ]

  return (
    <Modal title={exam ? 'editar examen' : 'nuevo examen'} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        {savedMessage && <Alert tone="success">{savedMessage}</Alert>}

        {/* Lista compacta en rejilla: se lee mejor que muchas etiquetas [..] sueltas. */}
        <div className="space-y-0.5">
          <span className="block">asignatura</span>
          <div className="grid grid-cols-2 border-t border-l border-line sm:grid-cols-3" role="radiogroup" aria-label="Asignatura">
            {subjects.map((s) => {
              const active = values.subject_id === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => set({ subject_id: s.id })}
                  className={`flex min-h-11 min-w-0 items-center gap-1 border-r border-b border-line px-1 text-left sm:min-h-8 ${
                    active ? 'bg-black text-white' : linkClass
                  }`}
                >
                  <SubjectDot subject={s} />
                  <span className="truncate">{s.name}</span>
                </button>
              )
            })}
          </div>
          {errors.subject_id && <p className="text-xs text-red-700">{errors.subject_id}</p>}
        </div>

        <div className="grid grid-cols-[1fr_7.5rem] gap-1">
          <Field label="fecha" error={errors.exam_date}>
            {(id) => (
              <input
                id={id}
                type="date"
                className={inputClass}
                value={values.exam_date}
                min={exam ? undefined : today}
                onChange={(e) => set({ exam_date: e.target.value })}
                required
              />
            )}
          </Field>
          <Field label="hora" error={errors.exam_time}>
            {(id) => (
              <input
                id={id}
                type="time"
                className={inputClass}
                value={values.exam_time}
                onChange={(e) => set({ exam_time: e.target.value })}
              />
            )}
          </Field>
        </div>

        <div className="-mt-2 flex items-center gap-2 text-xs text-muted">
          {quickDates.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => set({ exam_date: q.date })}
              className={`min-h-9 sm:min-h-0 ${values.exam_date === q.date ? 'text-black underline' : linkClass}`}
            >
              {q.label}
            </button>
          ))}
          {isValidIsoDate(values.exam_date) && (
            <span className="ml-auto text-black">
              {weekdayName(values.exam_date)} {formatDate(values.exam_date)}
            </span>
          )}
        </div>

        {showNote ? (
          <Field label="nota" error={errors.note}>
            {(id) => (
              <textarea
                id={id}
                rows={2}
                maxLength={MAX_NOTE_LENGTH}
                className={inputClass}
                placeholder="temas 3 y 4, comentario de texto…"
                value={values.note}
                autoFocus={!values.note}
                onChange={(e) => set({ note: e.target.value })}
              />
            )}
          </Field>
        ) : (
          <button type="button" onClick={() => setShowNote(true)} className={`min-h-9 text-muted sm:min-h-0 ${linkClass}`}>
            + añadir nota
          </button>
        )}

        {serverError && <Alert>{serverError}</Alert>}

        {confirmDelete ? (
          <div className="border-l-2 border-red-700 pl-2 text-red-700">
            <p>¿seguro que quieres eliminar este examen?</p>
            <Button type="button" variant="danger" loading={deleting} onClick={remove}>
              sí, eliminar
            </Button>{' '}
            <Button type="button" onClick={() => setConfirmDelete(false)}>
              cancelar
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1 pt-1">
            {exam ? (
              <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)}>
                eliminar
              </Button>
            ) : (
              <Button type="button" variant="ghost" disabled={saving} onClick={() => save(true)}>
                guardar y añadir otro
              </Button>
            )}
            <Button type="submit" variant="primary" loading={saving} className="ml-auto">
              guardar
            </Button>
          </div>
        )}
      </form>
    </Modal>
  )
}
