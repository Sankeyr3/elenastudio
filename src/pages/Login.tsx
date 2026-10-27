import { useState, type FormEvent } from 'react'
import { Alert, Button, Field, inputClass } from '../components/ui'
import { friendlyError } from '../lib/errors'
import { MOCK_USERS, resetMockData } from '../lib/mockSupabase'
import { supabase, useMocks } from '../lib/supabase'

export function Login() {
  const [jodes, setJodes] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const user = email.trim().toLowerCase()
    if (!user) return setError('Escribe tu usuario.')
    if (!password) return setError('Escribe tu contraseña.')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: useMocks || user.includes('@') ? user : `${user}@elenastudio.app`,
      password,
    })
    if (error) setError(friendlyError(error))
    setLoading(false)
  }

  if (jodes) {
    return (
      <div className="mx-auto max-w-xs space-y-2 px-2 pt-[15dvh]">
        <h1 className="text-2xl font-bold text-accent">pues te jodes ekisde</h1>
        <Button type="button" variant="ghost" onClick={() => setJodes(false)}>
          volver
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xs px-2 pt-[15dvh]">
      <h1 className="font-bold text-accent">elenastudio</h1>
      <form onSubmit={onSubmit} className="space-y-2" noValidate>
        <Field label="usuario">
          {(id) => (
            <input
              id={id}
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
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
        {error && <Alert>{error}</Alert>}
        <div className="flex flex-wrap justify-between gap-1 pt-1">
          <Button type="submit" variant="primary" loading={loading}>
            entrar
          </Button>
          <Button type="button" variant="ghost" onClick={() => setJodes(true)}>
            ¿olvidaste la contraseña?
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
