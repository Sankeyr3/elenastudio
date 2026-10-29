import { useState, type FormEvent } from 'react'
import {
  DEFAULT_HARD_EXTRA_DAYS,
  DEFAULT_OFFSETS,
  MAX_OFFSET_DAYS,
  MAX_OFFSETS,
  normalizeOffsets,
  validateRules,
} from '../../../shared/reminders'
import { Alert, Button, Field, inputClass, linkClass, tapClass } from '../../components/ui'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import type { ReminderSettings } from '../../lib/types'

export function SettingsForm({
  settings,
  onSaved,
}: {
  settings: ReminderSettings
  onSaved: (s: ReminderSettings) => void
}) {
  const [enabled, setEnabled] = useState(settings.enabled)
  const [offsets, setOffsets] = useState<number[]>(normalizeOffsets(settings.offsets))
  const [extra, setExtra] = useState(String(settings.hard_extra_days))
  const [newOffset, setNewOffset] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const addOffset = () => {
    const n = Number(newOffset)
    if (!newOffset || !Number.isInteger(n) || n < 0 || n > MAX_OFFSET_DAYS) {
      return setError(`Escribe un número de días entre 0 y ${MAX_OFFSET_DAYS}.`)
    }
    if (offsets.includes(n)) return setError('Ese plazo ya está en la lista.')
    if (offsets.length >= MAX_OFFSETS) return setError(`Como máximo ${MAX_OFFSETS} plazos.`)
    setOffsets(normalizeOffsets([...offsets, n]))
    setNewOffset('')
    setError(null)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaved(false)
    const rules = { offsets, hard_extra_days: Number(extra) }
    const invalid = validateRules(rules)
    if (invalid) return setError(invalid)
    setSaving(true)
    setError(null)
    const { data, error } = await supabase
      .from('reminder_settings')
      .update({ enabled, ...rules, updated_at: new Date().toISOString() })
      .eq('helper_id', settings.helper_id)
      .select()
      .single()
    setSaving(false)
    if (error) return setError(friendlyError(error))
    onSaved(data as ReminderSettings)
    setSaved(true)
  }

  const firstOffset = offsets[0] ?? 0
  const extraDays = Number(extra) || 0

  return (
    <form onSubmit={onSubmit} className="space-y-2" noValidate>
      <label className="flex min-h-11 items-center gap-2 desk:min-h-0">
        <input type="checkbox" className="h-6 w-6 shrink-0 accent-accent desk:h-4 desk:w-4" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span>
          avisos por notificación <span className="text-muted">(se revisan una vez al día, por la tarde)</span>
        </span>
      </label>

      <div className="space-y-0.5">
        <span className="block">avisar estos días antes de cada examen</span>
        <div className="flex flex-wrap items-center gap-x-3">
          {offsets.map((o) => (
            <span key={o} className="whitespace-nowrap">
              {o === 0 ? 'mismo día' : o === 1 ? '1 día' : `${o} días`}
              <button
                type="button"
                onClick={() => setOffsets(offsets.filter((x) => x !== o))}
                className={`text-muted ${tapClass} ${linkClass}`}
                aria-label={`Quitar ${o} días`}
              >
                [x]
              </button>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_OFFSET_DAYS}
            placeholder="días"
            className={`${inputClass} max-w-20`}
            value={newOffset}
            onChange={(e) => setNewOffset(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addOffset()
              }
            }}
          />
          <Button type="button" onClick={addOffset}>
            añadir plazo
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setOffsets(DEFAULT_OFFSETS)
              setExtra(String(DEFAULT_HARD_EXTRA_DAYS))
            }}
          >
            restablecer
          </Button>
        </div>
      </div>

      <Field
        label="adelanto extra para asignaturas difíciles (4 o 5)"
        hint={
          extraDays > 0 && firstOffset > 0
            ? `en las difíciles el primer aviso llega ${firstOffset + extraDays} días antes en lugar de ${firstOffset}.`
            : 'con 0, las difíciles usan los mismos plazos que el resto.'
        }
      >
        {(id) => (
          <div className="flex items-center gap-1">
            <input
              id={id}
              type="number"
              inputMode="numeric"
              min={0}
              max={30}
              className={`${inputClass} max-w-20`}
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
            />
            <span className="text-muted">días</span>
          </div>
        )}
      </Field>

      {error && <Alert>{error}</Alert>}
      {saved && <Alert tone="success">preferencias guardadas.</Alert>}
      <Button type="submit" variant="primary" loading={saving}>
        guardar preferencias
      </Button>
    </form>
  )
}
