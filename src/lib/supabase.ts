import { createClient } from '@supabase/supabase-js'
import { createMockClient } from './mockSupabase'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Modo sin conexión: la app usa datos de prueba locales en lugar de Supabase (ver mockSupabase.ts). */
export const useMocks = import.meta.env.VITE_USE_MOCKS === 'true'

export const configError =
  !useMocks && (!url || !key)
    ? 'Faltan VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY. Revisa el archivo .env.local (ver README).'
    : null

/** Esquema propio de la app (permite compartir el proyecto de Supabase con otra aplicación). */
export const DB_SCHEMA = 'elenastudy'

// Solo se usa la clave pública: los datos los protegen las políticas RLS de la base de datos.
const createRealClient = () =>
  createClient(url || 'http://localhost:54321', key || 'sin-configurar', {
    db: { schema: DB_SCHEMA },
  })

export const supabase: ReturnType<typeof createRealClient> = useMocks
  ? (createMockClient() as unknown as ReturnType<typeof createRealClient>)
  : createRealClient()
