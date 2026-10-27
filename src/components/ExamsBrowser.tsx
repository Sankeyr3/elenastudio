import { useState } from 'react'
import { formatDate, weekdayName } from '../../shared/dates'
import type { ExamWithSubject } from '../lib/types'
import { ExamList } from './ExamList'
import { MonthCalendar } from './MonthCalendar'
import { Button, linkClass, Tabs } from './ui'

/** Próximos exámenes en calendario (vista principal) o lista, más los pasados plegados. */
export function ExamsBrowser({
  upcoming,
  past,
  all,
  today,
  onEdit,
  onAdd,
}: {
  upcoming: ExamWithSubject[]
  past: ExamWithSubject[]
  all: ExamWithSubject[]
  today: string
  onEdit?: (exam: ExamWithSubject) => void
  /** Si se pasa, el calendario permite apuntar exámenes pulsando un día. */
  onAdd?: (date: string) => void
}) {
  const [view, setView] = useState<'list' | 'calendar'>('calendar')
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const dayExams = selectedDay ? all.filter((e) => e.exam_date === selectedDay) : []

  return (
    <div className="space-y-3">
      <Tabs
        tabs={[
          { id: 'calendar', label: 'calendario' },
          { id: 'list', label: 'lista' },
        ]}
        value={view}
        onChange={setView}
      />

      {view === 'list' ? (
        upcoming.length ? (
          <ExamList exams={upcoming} today={today} onEdit={onEdit} />
        ) : (
          <p className="text-muted">no hay exámenes próximos.</p>
        )
      ) : (
        <>
          <MonthCalendar exams={all} today={today} selected={selectedDay} onSelect={setSelectedDay} selectEmpty={!!onAdd} />
          {selectedDay ? (
            <div>
              {dayExams.length ? (
                <ExamList exams={dayExams} today={today} onEdit={onEdit} />
              ) : (
                <p className="mb-1 text-muted">
                  // sin exámenes el {weekdayName(selectedDay)} {formatDate(selectedDay)}
                </p>
              )}
              {onAdd && selectedDay >= today && (
                <Button variant="primary" onClick={() => onAdd(selectedDay)}>
                  + examen este día
                </Button>
              )}
            </div>
          ) : upcoming.length ? (
            <div>
              <p className="mb-1 text-muted">// próximos (pulsa un día para {onAdd ? 'filtrar o añadir' : 'filtrar'})</p>
              <ExamList exams={upcoming.slice(0, 5)} today={today} onEdit={onEdit} />
            </div>
          ) : (
            <p className="text-muted">no hay exámenes próximos.</p>
          )}
        </>
      )}

      {view === 'list' && past.length > 0 && (
        <details>
          <summary className="cursor-pointer text-muted select-none">pasados ({past.length})</summary>
          <ul className="mt-1 pl-2 text-muted">
            {past.map((e) => (
              <li key={e.id}>
                {onEdit ? (
                  <button onClick={() => onEdit(e)} className={linkClass}>
                    {formatDate(e.exam_date)} {e.subject.name}
                  </button>
                ) : (
                  <>
                    {formatDate(e.exam_date)} {e.subject.name}
                  </>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
