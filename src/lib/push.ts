// Notificaciones push en el dispositivo actual: permiso, suscripción (Web Push) y registro en Supabase.
import { supabase, useMocks } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

export type PushSupport =
  | 'ok'
  /** El navegador no admite notificaciones push. */
  | 'unsupported'
  /** iPhone/iPad: solo funcionan con la app añadida a la pantalla de inicio. */
  | 'ios-install'
  /** `npm run dev` o modo mock: no hay service worker. */
  | 'dev'
  /** Falta VITE_VAPID_PUBLIC_KEY. */
  | 'unconfigured'

export function pushSupport(): PushSupport {
  if (!import.meta.env.PROD || useMocks) return 'dev'
  if (!VAPID_PUBLIC_KEY) return 'unconfigured'
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
  if (isIos && !standalone) return 'ios-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  return 'ok'
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

/** Suscripción push de este dispositivo, si existe. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== 'ok') return null
  const registration = await navigator.serviceWorker.getRegistration()
  return (await registration?.pushManager.getSubscription()) ?? null
}

function deviceName(): string {
  const ua = navigator.userAgent
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iPhone/iPad' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : 'otro'
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'navegador'
  return `${browser} en ${os}`
}

/** Pide permiso, suscribe este dispositivo y lo guarda en Supabase. Devuelve un mensaje de error o null. */
export async function enablePush(): Promise<string | null> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return permission === 'denied'
      ? 'Has bloqueado las notificaciones para esta web. Actívalas en los ajustes del navegador (o del móvil) y vuelve a intentarlo.'
      : 'Necesitas permitir las notificaciones para recibir los avisos.'
  }
  const registration = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'))
  await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
    }))
  const { endpoint, keys } = subscription.toJSON()
  if (!endpoint || !keys?.p256dh || !keys.auth) return 'El navegador no ha devuelto una suscripción válida.'

  // Borrar y volver a crear: así se actualizan las claves si el navegador las ha cambiado.
  const { error: deleteError } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (deleteError) return deleteError.message
  const { error } = await supabase
    .from('push_subscriptions')
    .insert({ endpoint, p256dh: keys.p256dh, auth: keys.auth, device: deviceName() })
  return error ? error.message : null
}

/** Quita la suscripción de este dispositivo (en el navegador y en Supabase). */
export async function disablePush(): Promise<string | null> {
  const subscription = await currentSubscription()
  if (!subscription) return null
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
  await subscription.unsubscribe()
  return error ? error.message : null
}

/** Pide al servidor una notificación de prueba a todos tus dispositivos. */
export async function sendTestPush(): Promise<{ ok: boolean; message: string }> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return { ok: false, message: 'Tu sesión ha caducado. Vuelve a iniciar sesión.' }
  try {
    const res = await fetch('/api/push/test', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; delivered?: number; error?: string }
    if (res.ok && body.ok) {
      return { ok: true, message: `notificación enviada a ${body.delivered === 1 ? '1 dispositivo' : `${body.delivered} dispositivos`}.` }
    }
    return { ok: false, message: body.error ?? `Error ${res.status} al enviar la prueba.` }
  } catch {
    return { ok: false, message: 'No hay conexión. Comprueba tu internet e inténtalo de nuevo.' }
  }
}
