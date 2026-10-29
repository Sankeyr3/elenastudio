import { daysBetween, formatDate, formatTime, relativeDays, weekdayName } from '../../shared/dates'
import type { ExamWithSubject } from '../lib/types'
import { DifficultyBadge, SubjectDot } from './ui'

/** Lista compacta de exámenes agrupada por fecha. Si se pasa `onEdit`, cada examen es pulsable. */
export function ExamList({
  exams,
  today,
  onEdit,
}: {
  exams: ExamWithSubject[]
  today: string
  onEdit?: (exam: ExamWithSubject) => void
}) {
  const groups = new Map<string, ExamWithSubject[]>()
  for (const exam of exams) groups.set(exam.exam_date, [...(groups.get(exam.exam_date) ?? []), exam])

  return (
    <div className="space-y-2">
      {[...groups].map(([date, items]) => {
        const daysLeft = daysBetween(today, date)
        const soon = daysLeft >= 0 && daysLeft <= 3
        return (
          <div key={date}>
            <div className="flex items-baseline justify-between gap-2 border-b border-dashed border-line">
              <span>
                {weekdayName(date)} {formatDate(date)}
              </span>
              <span className={soon ? 'font-bold text-red-700' : 'text-muted'}>{relativeDays(daysLeft).toLowerCase()}</span>
            </div>
            <ul>
              {items.map((exam) => {
                const content = (
                  <>
                    <span className="flex items-center gap-x-2">
                      <SubjectDot subject={exam.subject} />
                      <span className="min-w-0 flex-1 truncate font-bold">{exam.subject.name}</span>
                      {exam.exam_time && <span>{formatTime(exam.exam_time)}</span>}
                      <DifficultyBadge difficulty={exam.subject.difficulty} />
                    </span>
                    {exam.note && <span className="block pl-4 whitespace-pre-line text-muted">{exam.note}</span>}
                  </>
                )
                return (
                  <li key={exam.id}>
                    {onEdit ? (
                      <button
                        onClick={() => onEdit(exam)}
                        className="block w-full px-1 py-2 text-left desk:py-0.5 hover:bg-ink/5 focus-visible:bg-ink/10 focus-visible:outline-none"
                        aria-label={`Editar examen de ${exam.subject.name} del ${formatDate(exam.exam_date)}`}
                      >
                        {content}
                      </button>
                    ) : (
                      <div className="px-1 py-1 desk:py-0.5">{content}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
