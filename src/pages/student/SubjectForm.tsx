import { useRef, useState, type FormEvent } from 'react'
import { SUBJECT_COLORS, SUBJECT_COLOR_LABELS, firstFreeColor, subjectColor, type SubjectColor } from '../../../shared/colors'
import { DIFFICULTY_LABELS, type Liking } from '../../../shared/labels'
import { Alert, Button, Choice, Field, Modal, inputClass } from '../../components/ui'
import { IconPad } from '../../components/IconPad'
import { COLOR_CLASSES } from '../../lib/colors'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import type { Subject } from '../../lib/types'
import { MAX_SUBJECT_NAME, validateSubjectName } from '../../lib/validation'

const LIKING_OPTIONS: { value: Liking | null; label: string }[] = [
  { value: 'mucho', label: 'Mucho' },
  { value: 'regular', label: 'Regular' },
  { value: 'poco', label: 'Poco' },
  { value: null, label: 'Sin indicar' },
]

export function SubjectForm({
  subject,
  subjects,
  examCount,
  onClose,
  onSaved,
}: {
  subject: Subject | null
  subjects: Subject[]
  examCount: number
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [name, setName] = useState(subject?.name ?? '')
  const [difficulty, setDifficulty] = useState<number | null>(subject?.difficulty ?? null)
  const [liking, setLiking] = useState<Liking | null>(subject?.liking ?? null)
  const [color, setColor] = useState<SubjectColor>(() => (subject ? subjectColor(subject) : firstFreeColor(subjects)))
  const [icon, setIcon] = useState(subject?.icon ?? '')
  const [nameError, setNameError] = useState<string | null>(null)
  const [difficultyError, setDifficultyError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const difficultyRef = useRef<HTMLDivElement>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const nErr = validateSubjectName(name, subjects, subject?.id)
    const dErr = difficulty ? null : 'Elige un número del 1 al 5.'
    setNameError(nErr)
    setDifficultyError(dErr)
    if (nErr || dErr) {
      // Lleva al primer campo que falta para que se vea qué hay que completar.
      const target = nErr ? nameRef.current : difficultyRef.current
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      ;(nErr ? nameRef.current : difficultyRef.current?.querySelector('button'))?.focus({ preventScroll: true })
      return
    }
    setSaving(true)
    setServerError(null)
    const row = { name: name.trim(), difficulty, liking, color, icon: icon || null }
    const { error } = subject
      ? await supabase.from('subjects').update(row).eq('id', subject.id)
      : await supabase.from('subjects').insert(row)
    setSaving(false)
    if (error) return setServerError(friendlyError(error))
    await onSaved()
    onClose()
  }

  async function remove() {
    if (!subject) return
    setDeleting(true)
    // Borra la asignatura y sus exámenes en una sola operación (función SQL delete_subject).
    const { error } = await supabase.rpc('delete_subject', { p_subject_id: subject.id })
    setDeleting(false)
    if (error) return setServerError(friendlyError(error))
    await onSaved()
    onClose()
  }

  return (
    <Modal title={subject ? 'editar asignatura' : 'nueva asignatura'} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-2" noValidate>
        <Field label="nombre" error={nameError}>
          {(id) => (
            <input
              id={id}
              ref={nameRef}
              className={`${inputClass} ${nameError ? 'border-red-700 bg-red-50 focus:border-red-700' : ''}`}
              aria-invalid={Boolean(nameError)}
              value={name}
              maxLength={MAX_SUBJECT_NAME}
              placeholder="historia"
              autoFocus={!subject}
              onChange={(e) => {
                setName(e.target.value)
                if (nameError) setNameError(null)
              }}
            />
          )}
        </Field>

        <div
          ref={difficultyRef}
          className={`space-y-0.5 ${difficultyError ? '-mx-1 border border-red-700 bg-red-50 px-1 py-0.5' : ''}`}
        >
          <span className="block">
            ¿cuánto te cuesta? <span className="text-muted">1 = muy poco · 5 = muchísimo</span>
          </span>
          <div className="grid grid-cols-5 gap-1 sm:flex sm:flex-wrap" role="radiogroup" aria-label="Dificultad">
            {[1, 2, 3, 4, 5].map((n) => (
              <Choice key={n} active={difficulty === n} onClick={() => {
                setDifficulty(n)
                setDifficultyError(null)
              }} label={`${n}: ${DIFFICULTY_LABELS[n]}`}>
                {n}
              </Choice>
            ))}
          </div>
          <p className={`text-xs ${difficultyError ? 'text-red-700' : 'text-muted'}`}>
            {difficultyError ?? (difficulty ? DIFFICULTY_LABELS[difficulty].toLowerCase() : ' ')}
          </p>
        </div>

        <div className="space-y-0.5">
          <span className="block">
            ¿te gusta? <span className="text-muted">(opcional)</span>
          </span>
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="¿Te gusta?">
            {LIKING_OPTIONS.map((o) => (
              <Choice key={o.label} active={liking === o.value} onClick={() => setLiking(o.value)}>
                {o.label.toLowerCase()}
              </Choice>
            ))}
          </div>
        </div>

        <div className="space-y-0.5">
          <span className="block">color</span>
          <div className="flex flex-wrap gap-2 sm:gap-1.5" role="radiogroup" aria-label="Color">
            {SUBJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={SUBJECT_COLOR_LABELS[c]}
                title={SUBJECT_COLOR_LABELS[c]}
                onClick={() => setColor(c)}
                className={`h-10 w-10 sm:h-5 sm:w-5 ${COLOR_CLASSES[c].dot} ${color === c ? 'outline-2 outline-offset-2 outline-black' : 'hover:opacity-70'}`}
              />
            ))}
          </div>
        </div>

        <div className="space-y-0.5">
          <span className="block">
            icono <span className="text-muted">(opcional, dibújalo)</span>
          </span>
          <IconPad value={icon} onChange={setIcon} colorClass={COLOR_CLASSES[color].text} />
        </div>

        {serverError && <Alert>{serverError}</Alert>}

        {confirmDelete ? (
          <div className="border-l-2 border-red-700 pl-2 text-red-700">
            {examCount > 0 ? (
              <p>
                <strong>{subject?.name}</strong> tiene {examCount} {examCount === 1 ? 'examen' : 'exámenes'}. Si la eliminas,{' '}
                {examCount === 1 ? 'ese examen también se borrará' : 'esos exámenes también se borrarán'}. Si solo quieres cambiar
                el nombre o la dificultad, mejor edítala.
              </p>
            ) : (
              <p>¿seguro que quieres eliminar esta asignatura?</p>
            )}
            <Button type="button" variant="danger" loading={deleting} onClick={remove}>
              {examCount > 0 ? 'eliminar asignatura y exámenes' : 'sí, eliminar'}
            </Button>{' '}
            <Button type="button" onClick={() => setConfirmDelete(false)}>
              cancelar
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1 border-t border-line pt-1">
            {subject && (
              <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)}>
                eliminar
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
