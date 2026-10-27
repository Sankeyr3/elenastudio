import { useState } from 'react'
import { formatDate, weekdayName } from '../../shared/dates'
import type { ExamWithSubject } from '../lib/types'
import { ExamList } from './ExamList'
import { MonthCalendar } from './MonthCalendar'
import { Button } from './ui'

/** Próximos exámenes en calendario; pulsando un día se filtra (o se añade, si hay `onAdd`). */
export function ExamsBrowser({
  upcoming,
  all,
  today,
  onEdit,
  onAdd,
}: {
  upcoming: ExamWithSubject[]
  all: ExamWithSubject[]
  today: string
  onEdit?: (exam: ExamWithSubject) => void
  /** Si se pasa, el calendario permite apuntar exámenes pulsando un día. */
  onAdd?: (date: string) => void
}) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const dayExams = selectedDay ? all.filter((e) => e.exam_date === selectedDay) : []

  return (
    <div className="space-y-3">
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
            <div className="mt-2 flex justify-end">
              <Button variant="primary" onClick={() => onAdd(selectedDay)}>
                + examen este día
              </Button>
            </div>
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
    </div>
  )
}
