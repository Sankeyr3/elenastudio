import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { Alert, Button, Loading, Tabs } from './components/ui'
import { friendlyError } from './lib/errors'
import { configError, supabase } from './lib/supabase'
import type { Profile } from './lib/types'
import { Login, NewPassword } from './pages/Login'
import { HelperApp, type HelperTab } from './pages/helper/HelperApp'
import { StudentApp, type StudentTab } from './pages/student/StudentApp'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    if (configError) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setSession(newSession)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (configError) {
    return (
      <div className="mx-auto max-w-lg p-3">
        <Alert>{configError}</Alert>
      </div>
    )
  }
  if (session === undefined) return <Loading />
  if (recovering && session) return <NewPassword onDone={() => setRecovering(false)} />
  if (!session) return <Login />
  return <SignedIn key={session.user.id} userId={session.user.id} />
}

function SignedIn({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [studentTab, setStudentTab] = useState<StudentTab>('examenes')
  const [helperTab, setHelperTab] = useState<HelperTab>('resumen')

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, role, display_name')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setError(friendlyError(error))
        else setProfile(data as Profile | null)
      })
  }, [userId])

  const signOut = () => void supabase.auth.signOut()

  return (
    <div className="mx-auto max-w-3xl px-2 pb-8 sm:px-4">
      <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-x-3 border-b border-black bg-white py-1">
        <span className="font-bold text-accent">estudion</span>
        <Button variant="ghost" className="sm:order-last" onClick={signOut}>
          salir
        </Button>
        {profile?.role === 'student' && (
          <Tabs
            fill
            tabs={[
              { id: 'examenes', label: 'exámenes' },
              { id: 'asignaturas', label: 'asignaturas' },
            ]}
            value={studentTab}
            onChange={setStudentTab}
          />
        )}
        {profile?.role === 'helper' && (
          <Tabs
            fill
            tabs={[
              { id: 'resumen', label: 'resumen' },
              { id: 'avisos', label: 'avisos' },
            ]}
            value={helperTab}
            onChange={setHelperTab}
          />
        )}
      </header>

      <main className="py-3">
        {error ? (
          <Alert>{error}</Alert>
        ) : profile === undefined ? (
          <Loading />
        ) : profile === null ? (
          <Alert tone="info">
            Tu cuenta existe pero aún no está configurada. Hay que ejecutar <code>setup_accounts</code> en Supabase (README, paso 9).
          </Alert>
        ) : profile.role === 'student' ? (
          <StudentApp profile={profile} tab={studentTab} onTab={setStudentTab} />
        ) : (
          <HelperApp profile={profile} tab={helperTab} />
        )}
      </main>
    </div>
  )
}
