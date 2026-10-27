import { useCallback, useEffect, useState } from 'react'
import { Alert, Button } from '../../components/ui'
import { friendlyError } from '../../lib/errors'
import { currentSubscription, disablePush, enablePush, pushSupport, sendTestPush } from '../../lib/push'
import { supabase } from '../../lib/supabase'
import type { PushDevice } from '../../lib/types'

const SUPPORT_MESSAGES = {
  'ios-install':
    'en iPhone las notificaciones solo funcionan con la app instalada: pulsa compartir → «añadir a pantalla de inicio», abre ElenaStudio desde el icono y vuelve aquí.',
  unsupported: 'este navegador no admite notificaciones push. Prueba con Chrome en Android o con Safari en iPhone (app instalada).',
  dev: 'las notificaciones solo funcionan en la versión publicada (no en npm run dev ni en modo mock).',
  unconfigured: 'falta VITE_VAPID_PUBLIC_KEY en Vercel (README, paso 14).',
} as const

/** Activar/desactivar las notificaciones en este dispositivo y ver en cuáles están activas. */
export function PushSetup({ onDevicesChange }: { onDevicesChange?: (count: number) => void }) {
  const support = pushSupport()
  const [devices, setDevices] = useState<PushDevice[]>([])
  const [thisEndpoint, setThisEndpoint] = useState<string | null>(null)
  const [busy, setBusy] = useState<'enable' | 'disable' | 'test' | null>(null)
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)

  const load = useCallback(async () => {
    const [{ data, error }, subscription] = await Promise.all([
      supabase.from('push_subscriptions').select('id, endpoint, device, created_at').order('created_at'),
      currentSubscription().catch(() => null),
    ])
    if (error) return setMessage({ tone: 'error', text: friendlyError(error) })
    const list = (data ?? []) as PushDevice[]
    setDevices(list)
    setThisEndpoint(subscription?.endpoint ?? null)
    onDevicesChange?.(list.length)
  }, [onDevicesChange])

  useEffect(() => {
    void load()
  }, [load])

  const active = thisEndpoint !== null && devices.some((d) => d.endpoint === thisEndpoint)

  async function run(action: 'enable' | 'disable' | 'test') {
    setBusy(action)
    setMessage(null)
    try {
      if (action === 'test') {
        const result = await sendTestPush()
        setMessage({ tone: result.ok ? 'success' : 'error', text: result.message })
      } else {
        const error = action === 'enable' ? await enablePush() : await disablePush()
        if (error) setMessage({ tone: 'error', text: error })
        else setMessage({ tone: 'success', text: action === 'enable' ? 'notificaciones activadas en este dispositivo.' : 'notificaciones desactivadas en este dispositivo.' })
        await load()
      }
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : String(err) })
    }
    setBusy(null)
  }

  return (
    <div className="space-y-1">
      <p>
        este dispositivo:{' '}
        {support !== 'ok' ? (
          <span className="text-muted">no disponible</span>
        ) : active ? (
          <span className="font-bold text-green-700">notificaciones activadas</span>
        ) : (
          <span className="font-bold">sin activar</span>
        )}
      </p>
      {support !== 'ok' && <Alert tone="info">{SUPPORT_MESSAGES[support]}</Alert>}

      <div className="flex flex-wrap items-center gap-1">
        {support === 'ok' && !active && (
          <Button type="button" variant="primary" loading={busy === 'enable'} onClick={() => void run('enable')}>
            activar notificaciones aquí
          </Button>
        )}
        {support === 'ok' && active && (
          <Button type="button" variant="ghost" loading={busy === 'disable'} onClick={() => void run('disable')}>
            desactivar aquí
          </Button>
        )}
        {devices.length > 0 && (
          <Button type="button" loading={busy === 'test'} onClick={() => void run('test')}>
            enviar notificación de prueba
          </Button>
        )}
      </div>

      {devices.length > 0 ? (
        <p className="text-xs text-muted">
          activas en:{' '}
          {devices.map((d) => `${d.device ?? 'dispositivo'}${d.endpoint === thisEndpoint ? ' (este)' : ''}`).join(', ')}
        </p>
      ) : (
        <p className="text-xs text-muted">
          aún no hay ningún dispositivo. Abre ElenaStudio en tu móvil, entra con tu cuenta y pulsa «activar notificaciones aquí».
        </p>
      )}
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
    </div>
  )
}
