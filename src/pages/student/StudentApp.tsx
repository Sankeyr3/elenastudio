import { useState } from 'react'
import { ExamsBrowser } from '../../components/ExamsBrowser'
import { Alert, Button, DifficultyBadge, EmptyState, Heading, Loading, LikingText, SubjectDot } from '../../components/ui'
import type { ExamWithSubject, Profile, Subject } from '../../lib/types'
import { useStudentData } from '../../lib/useStudentData'
import { ExamForm } from './ExamForm'
import { SubjectForm } from './SubjectForm'

export type StudentTab = 'examenes' | 'asignaturas'

export function StudentApp({ profile, tab, onTab }: { profile: Profile; tab: StudentTab; onTab: (t: StudentTab) => void }) {
  const data = useStudentData(profile.id)
  const [examForm, setExamForm] = useState<{ exam: ExamWithSubject | null; date?: string } | null>(null)
  const [subjectForm, setSubjectForm] = useState<{ subject: Subject | null } | null>(null)

  if (data.loading) return <Loading />

  const examCount = (subjectId: string) => data.exams.filter((e) => e.subject_id === subjectId).length

  return (
    <>
      {data.error && (
        <div className="mb-3">
          <Alert>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{data.error}</span>
              <Button onClick={() => void data.reload()}>reintentar</Button>
            </div>
          </Alert>
        </div>
      )}

      {tab === 'examenes' ? (
        <div>
          {data.subjects.length === 0 ? (
            <EmptyState title="empieza añadiendo tus asignaturas">
              <p>así luego podrás apuntar cada examen en unos segundos.</p>
              <div className="mt-1 flex justify-end">
                <Button variant="primary" onClick={() => onTab('asignaturas')}>
                  ir a asignaturas
                </Button>
              </div>
            </EmptyState>
          ) : (
            <ExamsBrowser
              upcoming={data.upcoming}
              all={data.exams}
              today={data.today}
              onEdit={(exam) => setExamForm({ exam })}
              onAdd={(date) => setExamForm({ exam: null, date })}
            />
          )}
        </div>
      ) : (
        <div>
          <Heading
            as="h1"
            right={
              <Button variant="primary" onClick={() => setSubjectForm({ subject: null })}>
                + asignatura
              </Button>
            }
          >
            asignaturas
          </Heading>
          <p className="mb-2 text-muted">■ = cuánto te cuesta, de 1 (muy poco) a 5 (muchísimo).</p>
          {data.subjects.length === 0 ? (
            <EmptyState title="aún no hay asignaturas">
              <p>añade las asignaturas please</p>
            </EmptyState>
          ) : (
            <ul>
              {[...data.subjects]
                .sort((a, b) => b.difficulty - a.difficulty || a.name.localeCompare(b.name, 'es'))
                .map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => setSubjectForm({ subject: s })}
                      className="flex w-full items-center gap-2 border-b border-dashed border-line px-1 py-3 text-left hover:bg-ink/5 desk:py-0.5"
                    >
                      <SubjectDot subject={s} />
                      <span className="min-w-0 flex-1 truncate font-bold">{s.name}</span>
                      <span className="hidden sm:inline">
                        <LikingText liking={s.liking} />
                      </span>
                      <DifficultyBadge difficulty={s.difficulty} />
                      <span className="w-10 shrink-0 text-right text-muted">{examCount(s.id)} ex</span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      {examForm && (
        <ExamForm
          subjects={data.subjects}
          exam={examForm.exam}
          initialDate={examForm.date}
          today={data.today}
          onClose={() => setExamForm(null)}
          onSaved={data.reload}
        />
      )}
      {subjectForm && (
        <SubjectForm
          subject={subjectForm.subject}
          subjects={data.subjects}
          examCount={subjectForm.subject ? examCount(subjectForm.subject.id) : 0}
          onClose={() => setSubjectForm(null)}
          onSaved={data.reload}
        />
      )}
    </>
  )
}
