// Envío de notificaciones Web Push a los dispositivos del ayudante (claves VAPID).
import type { SupabaseClient } from '@supabase/supabase-js'
import webpush, { type WebPushError } from 'web-push'
import type { NotificationPayload } from './notification.js'

export interface SendResult {
  ok: boolean
  error: string | null
  /** Dispositivos a los que ha llegado la notificación. */
  delivered: number
}

/** Cuánto tiempo guarda el servicio push la notificación si el móvil está apagado o sin conexión. */
const TTL_SECONDS = 12 * 60 * 60

export async function sendToHelper(
  db: SupabaseClient<any, 'elenastudio'>,
  helperId: string,
  payload: NotificationPayload,
): Promise<SendResult> {
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    return {
      ok: false,
      delivered: 0,
      error: 'Notificaciones sin configurar: faltan VITE_VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY en Vercel.',
    }
  }
  // Apple exige un "subject" https: o mailto: válido (no localhost).
  const subject = process.env.VAPID_SUBJECT || process.env.APP_URL || 'https://elenastudio.vercel.app'

  const { data, error } = await db
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('helper_id', helperId)
  if (error) throw error
  const subscriptions = (data ?? []) as { id: string; endpoint: string; p256dh: string; auth: string }[]
  if (subscriptions.length === 0) {
    return {
      ok: false,
      delivered: 0,
      error: 'No hay ningún móvil con las notificaciones activadas (pestaña [avisos]).',
    }
  }

  const errors: string[] = []
  const expired: string[] = []
  let delivered = 0
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: TTL_SECONDS, urgency: 'high', vapidDetails: { subject, publicKey, privateKey } },
      )
      delivered++
    } catch (err) {
      const status = err instanceof webpush.WebPushError ? err.statusCode : null
      // 404/410: el dispositivo ya no existe o se desactivaron las notificaciones. Se olvida.
      if (status === 404 || status === 410) expired.push(sub.id)
      else errors.push(status ? `push ${status}: ${(err as WebPushError).body || 'error'}` : (err as Error).message)
    }
  }

  if (expired.length) {
    const { error: deleteError } = await db.from('push_subscriptions').delete().in('id', expired)
    if (deleteError) console.error('No se pudieron borrar suscripciones caducadas:', deleteError.message)
  }

  if (delivered > 0) return { ok: true, delivered, error: null }
  return {
    ok: false,
    delivered: 0,
    error: errors.length
      ? `No se pudo enviar la notificación: ${errors.join('; ')}`
      : 'Las notificaciones de tus dispositivos han caducado. Vuelve a activarlas en la pestaña [avisos].',
  }
}
