/** Convierte errores técnicos en mensajes comprensibles. */
export function friendlyError(error: unknown): string {
  const message =
    typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : String(error)

  if (/PGRST106|Invalid schema|schema must be one of/i.test(message))
    return 'El esquema "elenastudy" no está expuesto en Supabase (README, paso 4: Data API > Exposed schemas).'
  if (/Invalid login credentials/i.test(message)) return 'Correo o contraseña incorrectos.'
  if (/Email not confirmed/i.test(message)) return 'Esta cuenta aún no está confirmada. Revisa la configuración en Supabase.'
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) return 'No hay conexión. Comprueba tu internet e inténtalo de nuevo.'
  if (/rate limit|too many/i.test(message)) return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'
  if (/subjects_student_name_key|duplicate key/i.test(message)) return 'Ya tienes una asignatura con ese nombre.'
  if (/row-level security|permission denied/i.test(message)) return 'No tienes permiso para hacer esto.'
  if (/JWT expired|session/i.test(message)) return 'Tu sesión ha caducado. Vuelve a iniciar sesión.'
  const minLength = message.match(/Password should be at least (\d+)/i)
  if (minLength) return `La contraseña debe tener al menos ${minLength[1]} caracteres.`
  if (/should be different from the old password/i.test(message)) return 'La nueva contraseña debe ser distinta de la anterior.'
  return 'Algo ha fallado. Inténtalo de nuevo en unos segundos.'
}
