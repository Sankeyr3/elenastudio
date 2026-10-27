import { useState, type FormEvent } from 'react'
import { Alert, Button, Field, inputClass } from '../components/ui'
import { friendlyError } from '../lib/errors'
import { MOCK_USERS, resetMockData } from '../lib/mockSupabase'
import { supabase, useMocks } from '../lib/supabase'

export function Login() {
  const [mode, setMode] = useState<'login' | 'reset'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (!email.trim()) return setError('Escribe tu correo.')
    setLoading(true)
    if (mode === 'login') {
      if (!password) {
        setLoading(false)
        return setError('Escribe tu contraseña.')
      }
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) setError(friendlyError(error))
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin })
      if (error) setError(friendlyError(error))
      else setInfo('Si el correo corresponde a una cuenta, recibirás un enlace para elegir una contraseña nueva.')
    }
    setLoading(false)
  }

  return (
    <div className="mx-auto max-w-xs px-2 pt-[15dvh]">
      <h1 className="font-bold text-accent">elenastudio</h1>
      <p className="mb-3 border-b border-line pb-1 text-muted">tus exámenes, sin agobios.</p>
      <form onSubmit={onSubmit} className="space-y-2" noValidate>
        <Field label="correo">
          {(id) => (
            <input
              id={id}
              type="email"
              autoComplete="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
        {mode === 'login' && (
          <Field label="contraseña">
            {(id) => (
              <input
                id={id}
                type="password"
                autoComplete="current-password"
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>
        )}
        {error && <Alert>{error}</Alert>}
        {info && <Alert tone="success">{info}</Alert>}
        <div className="flex flex-wrap justify-between gap-1 pt-1">
          <Button type="submit" variant="primary" loading={loading}>
            {mode === 'login' ? 'entrar' : 'enviar enlace'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setMode(mode === 'login' ? 'reset' : 'login')
              setError(null)
              setInfo(null)
            }}
          >
            {mode === 'login' ? '¿olvidaste la contraseña?' : 'volver'}
          </Button>
        </div>
      </form>
      {useMocks && (
        <div className="mt-4">
          <Alert tone="info">
            modo sin conexión (datos de prueba). Entra con {MOCK_USERS.map((u) => u.email).join(' o ')} y cualquier contraseña.{' '}
            <Button type="button" onClick={resetMockData}>
              reiniciar datos
            </Button>
          </Alert>
        </div>
      )}
      <p className="mt-4 text-xs text-muted">aplicación privada. no hay registro público.</p>
    </div>
  )
}

export function NewPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) return setError('Usa al menos 8 caracteres.')
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) return setError(friendlyError(error))
    onDone()
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-xs space-y-2 px-2 pt-[15dvh]" noValidate>
      <h1 className="border-b border-line pb-1 font-bold">elige una contraseña nueva</h1>
      <Field label="nueva contraseña" hint="mínimo 8 caracteres.">
        {(id) => (
          <input
            id={id}
            type="password"
            autoComplete="new-password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
      </Field>
      {error && <Alert>{error}</Alert>}
      <Button type="submit" variant="primary" loading={loading}>
        guardar contraseña
      </Button>
    </form>
  )
}
