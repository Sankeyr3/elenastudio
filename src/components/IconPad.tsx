import { useRef, useState, type PointerEvent } from 'react'
import { ICON_SIZE, isHexColor, MAX_ICON_LENGTH, parseIcon, serializeIcon, type Point, type Stroke } from '../../shared/icon'
import { Button, IconSvg } from './ui'

/** Puntos más cercanos que esto (en unidades de la cuadrícula 0–100) se descartan: menos datos, trazo igual. */
const MIN_STEP = 1.5
/** Margen para no pasar del tamaño máximo que admite la base de datos con el trazo en curso. */
const LENGTH_MARGIN = 100

/** Tintas rápidas; con el selector «otro» se puede elegir cualquier color. */
const INKS = [
  '#000000',
  '#6b7280',
  '#92400e',
  '#e11d48',
  '#f97316',
  '#facc15',
  '#84cc16',
  '#059669',
  '#0ea5e9',
  '#4f46e5',
  '#7c3aed',
  '#ec4899',
]

/**
 * Lienzo para dibujar el icono de una asignatura con el dedo, el lápiz o el ratón.
 * `colorClass` es la clase de texto del color de la asignatura: la tinta «asignatura» la sigue aunque se cambie después.
 */
export function IconPad({ value, onChange, colorClass }: { value: string; onChange: (icon: string) => void; colorClass: string }) {
  const [strokes, setStrokes] = useState<Stroke[]>(() => parseIcon(value))
  const [ink, setInk] = useState<string | null>(null)
  const [custom, setCustom] = useState('#ff6600')
  const drawing = useRef(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const icon = serializeIcon(strokes)
  const full = icon.length >= MAX_ICON_LENGTH - LENGTH_MARGIN

  const update = (next: Stroke[]) => {
    setStrokes(next)
    onChange(serializeIcon(next))
  }

  const toPoint = (e: PointerEvent): Point => {
    const rect = svgRef.current!.getBoundingClientRect()
    return [((e.clientX - rect.left) / rect.width) * ICON_SIZE, ((e.clientY - rect.top) / rect.height) * ICON_SIZE]
  }

  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    if (full) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    update([...strokes, { color: ink, points: [toPoint(e)] }])
  }

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!drawing.current || full) return
    const p = toPoint(e)
    const current = strokes[strokes.length - 1]
    const [lx, ly] = current.points[current.points.length - 1]
    if (Math.hypot(p[0] - lx, p[1] - ly) < MIN_STEP) return
    update([...strokes.slice(0, -1), { ...current, points: [...current.points, p] }])
  }

  const onUp = () => {
    drawing.current = false
  }

  const swatch = (active: boolean) =>
    `h-9 w-9 shrink-0 border border-line sm:h-6 sm:w-6 ${active ? 'outline-2 outline-offset-2 outline-ink' : 'hover:opacity-70'}`

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 sm:gap-1.5" role="radiogroup" aria-label="Tinta">
        <button
          type="button"
          role="radio"
          aria-checked={ink === null}
          aria-label="Color de la asignatura"
          title="Color de la asignatura"
          onClick={() => setInk(null)}
          className={`${swatch(ink === null)} ${colorClass} flex items-center justify-center bg-current`}
        >
          <span className="text-[10px] leading-none font-bold text-white mix-blend-difference">A</span>
        </button>
        {INKS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={ink === c}
            aria-label={`Tinta ${c}`}
            title={c}
            onClick={() => setInk(c)}
            className={swatch(ink === c)}
            style={{ backgroundColor: c }}
          />
        ))}
        <label
          className={`${swatch(ink === custom)} relative cursor-pointer`}
          style={{ background: ink === custom ? custom : 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}
          title="Otro color"
        >
          <input
            type="color"
            value={custom}
            aria-label="Otro color"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={(e) => {
              const c = e.target.value.toLowerCase()
              if (!isHexColor(c)) return
              setCustom(c)
              setInk(c)
            }}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-start gap-3">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${ICON_SIZE} ${ICON_SIZE}`}
          className={`h-48 w-48 shrink-0 cursor-crosshair touch-none border border-line bg-paper select-none sm:h-36 sm:w-36 ${colorClass}`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          role="img"
          aria-label="Lienzo para dibujar el icono"
        >
          {/* Guías suaves para centrar el dibujo. */}
          <path d="M50 0V100M0 50H100" stroke="black" strokeOpacity={0.08} strokeDasharray="2 3" />
          <IconSvg icon={icon} />
        </svg>
        <div className="space-y-1">
          <div className={`flex items-end gap-2 ${colorClass}`} aria-label="Vista previa">
            <IconSvg icon={icon} className="h-4 w-4" />
            <IconSvg icon={icon} className="h-8 w-8" />
          </div>
          <div className="flex flex-col items-start gap-1">
            <Button type="button" disabled={!strokes.length} onClick={() => update(strokes.slice(0, -1))}>
              deshacer
            </Button>
            <Button type="button" variant="danger" disabled={!strokes.length} onClick={() => update([])}>
              borrar
            </Button>
          </div>
          {full && <p className="text-xs text-red-700">dibujo al máximo de detalle.</p>}
        </div>
      </div>
    </div>
  )
}
