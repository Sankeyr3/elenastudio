import { formatDate, TIME_ZONE } from '../../../shared/dates'
import type { ReminderLog } from '../../lib/types'

const STATUS = {
  sent: { label: 'ok', className: 'text-green-700' },
  failed: { label: 'error', className: 'font-bold text-red-700' },
  sending: { label: '¿?', className: 'text-muted' },
} as const

function formatDateTime(iso: string) {
  const parts = new Intl.DateTimeFormat('es-ES', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
  return parts.replace(',', '')
}

export function ReminderLogList({ logs, empty }: { logs: ReminderLog[]; empty: string }) {
  if (logs.length === 0) return <p className="text-muted">{empty}</p>
  return (
    <ul>
      {logs.map((log) => (
        <li key={log.id} className="border-b border-dashed border-line px-1 py-1.5 sm:py-0.5">
          <div className="flex items-baseline gap-2">
            <span className={`w-16 shrink-0 ${STATUS[log.status].className}`}>[{STATUS[log.status].label}]</span>
            <span className="min-w-0 flex-1">
              {log.subject_name}{' '}
              <span className="text-muted">
                examen {formatDate(log.exam_date)} · -{log.offset_days}d
                {log.attempts > 1 && ` · ${log.attempts} intentos`}
                {!log.exam_id && ' · examen eliminado'}
              </span>
            </span>
            <span className="hidden shrink-0 text-muted sm:inline">{formatDateTime(log.sent_at ?? log.created_at)}</span>
          </div>
          {log.status === 'failed' && log.last_error && <p className="pl-[4.5rem] text-xs text-red-700">{log.last_error}</p>}
        </li>
      ))}
    </ul>
  )
}
