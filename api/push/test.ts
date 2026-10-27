// Notificación de prueba a los dispositivos del ayudante, desde el botón de la pestaña [avisos].
// Solo para el propio ayudante: requiere su sesión de Supabase (Authorization: Bearer <access_token>).
import { createClient } from '@supabase/supabase-js'
import { buildReminderNotification } from '../_lib/notification.js'
import { sendToHelper } from '../_lib/push.js'

export const config = { maxDuration: 15 }

function json(body: unknown, status = 200) {
  return Response.json(body, { status })
}

export async function POST(request: Request): Promise<Response> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Faltan SUPABASE_URL/VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Vercel.' }, 500)
  }

  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1]
  if (!token) return json({ error: 'No autorizado' }, 401)

  const db = createClient(supabaseUrl, serviceKey, {
    db: { schema: 'elenastudio' },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: auth, error: authError } = await db.auth.getUser(token)
  if (authError || !auth.user) return json({ error: 'No autorizado' }, 401)

  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('role')
    .eq('id', auth.user.id)
    .maybeSingle()
  if (profileError) return json({ error: profileError.message }, 500)
  if (profile?.role !== 'helper') return json({ error: 'Solo para la cuenta de ayudante.' }, 403)

  const { data: link } = await db
    .from('helper_links')
    .select('student:profiles!helper_links_student_id_fkey(display_name)')
    .eq('helper_id', auth.user.id)
    .limit(1)
    .maybeSingle()
  const studentName = (link?.student as { display_name?: string } | null)?.display_name ?? 'tu estudiante'

  try {
    const result = await sendToHelper(
      db,
      auth.user.id,
      buildReminderNotification({ studentName, reminders: [], appUrl: process.env.APP_URL || null, test: true }),
    )
    return json(result, result.ok ? 200 : 502)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : JSON.stringify(err) }, 500)
  }
}
