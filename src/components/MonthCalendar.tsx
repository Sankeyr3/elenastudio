import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { subjectColor } from '../../shared/colors'
import { addDays, monthName, weekdayMondayFirst } from '../../shared/dates'
import { COLOR_CLASSES } from '../lib/colors'
import type { ExamWithSubject } from '../lib/types'
import { isValidIcon } from '../../shared/icon'
import { IconSvg, linkClass, tapClass } from './ui'

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
/** Exámenes visibles por día; el resto se resume como «+N». */
const MAX_CHIPS = 3
/** Meses navegables alrededor de hoy (se amplía si hay exámenes más lejos). */
const MONTHS_BEFORE = 6
const MONTHS_AFTER = 12

/** 'AAAA-MM' desplazado `delta` meses. */
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7)
}

function monthDiff(from: string, to: string): number {
  const [y1, m1] = from.split('-').map(Number)
  const [y2, m2] = to.split('-').map(Number)
  return (y2 - y1) * 12 + (m2 - m1)
}

/**
 * Calendario mensual en carrusel: se desliza (o con las flechas) entre meses y muestra cada examen con el color de su asignatura.
 * Con `selectEmpty`, también se pueden seleccionar los días libres de lunes a viernes, de hoy en adelante (para añadir un examen ese día).
 */
export function MonthCalendar({
  exams,
  today,
  selected,
  onSelect,
  selectEmpty = false,
}: {
  exams: ExamWithSubject[]
  today: string
  selected: string | null
  onSelect: (date: string | null) => void
  selectEmpty?: boolean
}) {
  const todayMonth = today.slice(0, 7)

  const months = useMemo(() => {
    const dates = exams.map((e) => e.exam_date.slice(0, 7)).sort()
    let first = shiftMonth(todayMonth, -MONTHS_BEFORE)
    let last = shiftMonth(todayMonth, MONTHS_AFTER)
    if (dates.length && dates[0] < first) first = dates[0]
    if (dates.length && dates[dates.length - 1] > last) last = dates[dates.length - 1]
    return Array.from({ length: monthDiff(first, last) + 1 }, (_, i) => shiftMonth(first, i))
  }, [exams, todayMonth])

  const byDate = useMemo(() => {
    const map = new Map<string, ExamWithSubject[]>()
    for (const e of exams) map.set(e.exam_date, [...(map.get(e.exam_date) ?? []), e])
    return map
  }, [exams])

  const todayIndex = Math.max(0, months.indexOf(todayMonth))
  const [index, setIndex] = useState(todayIndex)
  const trackRef = useRef<HTMLDivElement>(null)
  const indexRef = useRef(index)
  indexRef.current = index

  const scrollToIndex = (i: number, behavior: ScrollBehavior) => {
    const el = trackRef.current
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior })
  }

  // Al montar, se coloca en el mes actual sin animación.
  useLayoutEffect(() => {
    scrollToIndex(todayIndex, 'instant')
  }, [])

  // Si cambia el ancho (giro del móvil, ventana), se mantiene el mes visible.
  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const observer = new ResizeObserver(() => scrollToIndex(indexRef.current, 'instant'))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const onScroll = () => {
    const el = trackRef.current
    if (!el || !el.clientWidth) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    if (i !== indexRef.current) {
      setIndex(i)
      onSelect(null)
    }
  }

  const go = (i: number) => scrollToIndex(Math.min(Math.max(i, 0), months.length - 1), 'smooth')
  const current = months[index] ?? todayMonth
  const [year, monthNum] = current.split('-').map(Number)

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => go(index - 1)} disabled={index === 0} className={`min-w-11 ${tapClass} ${linkClass}`} aria-label="Mes anterior">
          [&lt;]
        </button>
        <span className="flex items-baseline gap-2">
          <span className="font-bold" aria-live="polite">
            {monthName(year, monthNum - 1).toLowerCase()}
          </span>
          {current !== todayMonth && (
            <button onClick={() => go(todayIndex)} className={`text-muted ${tapClass} ${linkClass}`}>
              [hoy]
            </button>
          )}
        </span>
        <button onClick={() => go(index + 1)} disabled={index === months.length - 1} className={`min-w-11 ${tapClass} ${linkClass}`} aria-label="Mes siguiente">
          [&gt;]
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-muted">
        {WEEKDAYS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {months.map((month, i) => (
          <MonthGrid
            key={month}
            month={month}
            today={today}
            byDate={byDate}
            selected={selected}
            onSelect={onSelect}
            selectEmpty={selectEmpty}
            // Solo el mes visible es accesible con teclado.
            inert={i !== index}
          />
        ))}
      </div>
    </div>
  )
}

function MonthGrid({
  month,
  today,
  byDate,
  selected,
  onSelect,
  selectEmpty,
  inert,
}: {
  month: string
  today: string
  byDate: Map<string, ExamWithSubject[]>
  selected: string | null
  onSelect: (date: string | null) => void
  selectEmpty: boolean
  inert: boolean
}) {
  const [year, monthNum] = month.split('-').map(Number)
  const first = `${month}-01`
  const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate()
  const leading = weekdayMondayFirst(first)
  // Siempre 6 semanas, para que el carrusel no cambie de altura entre meses.
  const trailing = 42 - leading - daysInMonth
  const cell = 'min-h-16 min-w-0 border-r border-b border-line'

  return (
    <section
      className="grid w-full shrink-0 snap-start snap-always grid-cols-7 border-t border-l border-line"
      inert={inert}
      aria-label={monthName(year, monthNum - 1)}
    >
      {Array.from({ length: leading }, (_, i) => (
        <div key={`lead-${i}`} className={`${cell} bg-ink/[0.03]`} />
      ))}
      {Array.from({ length: daysInMonth }, (_, i) => {
        const date = addDays(first, i)
        const dayExams = byDate.get(date) ?? []
        const isToday = date === today
        const isSelected = date === selected
        const isPast = date < today
        // Sábado y domingo no hay clase: solo se pueden pulsar si ya tienen algún examen.
        const isWeekend = weekdayMondayFirst(date) >= 5
        const selectable = dayExams.length > 0 || (selectEmpty && !isPast && !isWeekend)
        const extra = dayExams.length - MAX_CHIPS
        return (
          <button
            key={date}
            onClick={() => onSelect(isSelected ? null : date)}
            disabled={!selectable}
            aria-pressed={isSelected}
            aria-label={`${i + 1}${dayExams.length ? `: ${dayExams.map((e) => e.subject.name).join(', ')}` : ''}`}
            className={`${cell} flex flex-col gap-px p-px text-left ${isWeekend ? 'bg-ink/[0.03]' : ''} ${
              isSelected ? 'outline-2 -outline-offset-2 outline-accent' : selectable ? 'hover:bg-ink/5' : ''
            }`}
          >
            <span className="flex items-start justify-between">
              <span className={`px-0.5 text-[11px] leading-4 ${isToday ? 'bg-accent font-bold text-on-accent' : isPast ? 'text-ink/30' : ''}`}>
                {i + 1}
              </span>
              {extra > 0 && <span className="px-0.5 text-[10px] leading-4 text-muted">+{extra}</span>}
            </span>
            {dayExams.slice(0, MAX_CHIPS).map((e) => (
              <span
                key={e.id}
                className={`flex min-w-0 items-center gap-0.5 px-0.5 text-[10px] leading-[14px] ${COLOR_CLASSES[subjectColor(e.subject)].chip} ${isPast ? 'opacity-40' : ''}`}
              >
                {e.subject.icon && isValidIcon(e.subject.icon) && <IconSvg icon={e.subject.icon} className="h-3 w-3" />}
                <span className="truncate">{e.subject.name}</span>
              </span>
            ))}
          </button>
        )
      })}
      {Array.from({ length: trailing }, (_, i) => (
        <div key={`trail-${i}`} className={`${cell} bg-ink/[0.03]`} />
      ))}
    </section>
  )
}
