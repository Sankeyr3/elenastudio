import { useEffect, useId, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { subjectColor } from '../../shared/colors'
import { ICON_SIZE, iconPaths, isValidIcon } from '../../shared/icon'
import { DIFFICULTY_LABELS, LIKING_LABELS, type Liking } from '../../shared/labels'
import { isHard } from '../../shared/reminders'
import { COLOR_CLASSES } from '../lib/colors'
import type { Subject } from '../lib/types'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'font-bold text-accent',
  secondary: '',
  ghost: 'text-muted',
  danger: 'text-red-700',
}

/** Zona táctil: en móvil, al menos 44px de alto; en escritorio, compacto. */
export const tapClass = 'inline-flex min-h-11 items-center justify-center px-2 sm:min-h-0 sm:px-0.5'

/** Estilo común de todo lo pulsable: texto plano que se invierte al pasar el ratón. */
export const linkClass =
  'cursor-pointer hover:bg-[#666] hover:text-white focus-visible:bg-accent focus-visible:text-on-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-inherit'

/** Botón con forma de enlace entre corchetes: [guardar]. */
export function Button({
  variant = 'secondary',
  loading = false,
  className = '',
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button {...props} disabled={disabled || loading} className={`whitespace-nowrap ${tapClass} ${linkClass} ${VARIANTS[variant]} ${className}`}>
      [{children}
      {loading && '…'}]
    </button>
  )
}

/** Opción seleccionable (radio) con el mismo aspecto: la activa va en negativo. */
export function Choice({
  active,
  onClick,
  children,
  className = '',
  label,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  className?: string
  label?: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={label}
      onClick={onClick}
      className={`whitespace-nowrap ${tapClass} ${active ? 'bg-ink text-paper' : linkClass} ${className}`}
    >
      [{children}]
    </button>
  )
}

export function Loading({ text = 'cargando…' }: { text?: string }) {
  return (
    <p role="status" className="py-4 text-muted">
      {text}
    </p>
  )
}

export function Alert({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'info' | 'success' }) {
  const tones = {
    error: 'border-red-700 text-red-700',
    info: 'border-line text-muted',
    success: 'border-green-700 text-green-700',
  }
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`border-l-2 py-0.5 pl-2 ${tones[tone]}`}>
      {children}
    </div>
  )
}

/** Título de sección con una línea debajo y acciones opcionales a la derecha. */
export function Heading({ children, right, as: Tag = 'h2' }: { children: ReactNode; right?: ReactNode; as?: 'h1' | 'h2' }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-2 border-b border-line pb-0.5">
      <Tag className="font-bold">{children}</Tag>
      {right && <div className="flex flex-wrap justify-end gap-1">{right}</div>}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="border border-dashed border-line p-3">
      <p className="font-bold">{title}</p>
      {children && <div className="mt-1 text-muted">{children}</div>}
    </div>
  )
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string | null
  children: (id: string) => ReactNode
}) {
  const id = useId()
  return (
    <div className="space-y-0.5">
      <label htmlFor={id} className="block">
        {label}
      </label>
      {children(id)}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  )
}

// 16px en móvil para que iOS no haga zoom al enfocar.
export const inputClass =
  'block w-full rounded-none border border-line bg-paper px-1.5 py-2.5 text-[16px] sm:py-1 placeholder:text-muted focus:border-accent focus:outline-none sm:text-[13px]'

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-start sm:p-2 sm:pt-[10dvh]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[92dvh] w-full overflow-y-auto border-t border-ink bg-paper pb-[env(safe-area-inset-bottom)] sm:max-h-[85dvh] sm:max-w-md sm:border"
      >
        <div className="sticky top-0 flex items-center justify-between bg-ink pl-2 text-paper sm:py-0.5">
          <h2 className="font-bold">{title}</h2>
          <button onClick={onClose} className={`${tapClass} hover:bg-paper hover:text-ink`} aria-label="Cerrar">
            [x]
          </button>
        </div>
        <div className="p-3 sm:p-2">{children}</div>
      </div>
    </div>
  )
}

export function DifficultyBadge({ difficulty }: { difficulty: number }) {
  return (
    <span title={DIFFICULTY_LABELS[difficulty]} className={`whitespace-nowrap ${isHard(difficulty) ? 'text-red-700' : 'text-muted'}`}>
      {'■'.repeat(difficulty)}
      {'□'.repeat(5 - difficulty)}
    </span>
  )
}

/** Grosor del trazo de los iconos, en unidades de la cuadrícula 0–100. */
export const ICON_STROKE = 8

/** Dibuja un icono a mano alzada. Los trazos sin color propio usan el color de texto actual (el de la asignatura). */
export function IconSvg({ icon, className = '' }: { icon: string; className?: string }) {
  return (
    <svg viewBox={`0 0 ${ICON_SIZE} ${ICON_SIZE}`} aria-hidden className={`shrink-0 ${className}`}>
      {iconPaths(icon).map((run, i) => (
        <path
          key={i}
          d={run.d}
          fill="none"
          stroke={run.color ?? 'currentColor'}
          strokeWidth={ICON_STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}

/** Marca de la asignatura: su icono dibujado (en su color) o, si no tiene, un cuadrado de color. */
export function SubjectDot({ subject, className = '' }: { subject: Pick<Subject, 'id' | 'color' | 'icon'>; className?: string }) {
  const colors = COLOR_CLASSES[subjectColor(subject)]
  if (subject.icon && isValidIcon(subject.icon)) return <IconSvg icon={subject.icon} className={`h-4 w-4 ${colors.text} ${className}`} />
  // Mismo hueco que un icono (16px) para que los nombres queden alineados.
  return (
    <span aria-hidden className={`inline-flex h-4 w-4 shrink-0 items-center justify-center ${className}`}>
      <span className={`h-2 w-2 ${colors.dot}`} />
    </span>
  )
}

export function LikingText({ liking }: { liking: Liking | null }) {
  if (!liking) return null
  return <span className="text-muted">{LIKING_LABELS[liking].toLowerCase()}</span>
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  fill = false,
}: {
  tabs: { id: T; label: string }[]
  value: T
  onChange: (id: T) => void
  /** En móvil, ocupa una fila propia a todo el ancho (pestañas principales de la cabecera). */
  fill?: boolean
}) {
  return (
    <div
      className={fill ? 'grid w-full auto-cols-fr grid-flow-col gap-1 sm:flex sm:w-auto' : 'flex flex-wrap gap-1'}
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={`whitespace-nowrap ${tapClass} ${value === tab.id ? 'bg-ink text-paper' : linkClass}`}
        >
          [{tab.label}]
        </button>
      ))}
    </div>
  )
}
