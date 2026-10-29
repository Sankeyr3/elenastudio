/**
 * Iconos dibujados a mano, sobre una cuadrícula de 0 a 100. Se guardan como texto con estos elementos:
 *   "#rrggbb"  los trazos siguientes van en ese color
 *   "c"        los trazos siguientes van en el color de la asignatura (es el valor inicial)
 *   "w n"      los trazos siguientes tienen ese grosor, sin espacio: "w4" (el inicial es DEFAULT_ICON_WIDTH)
 *   "M x y"    empieza un trazo   ·   "L x y"  lo continúa (enteros)
 * Ejemplo: "M10 20L30 40#000000w4M50 50L50 50". Los iconos sin colores ni grosores (solo M/L) siguen siendo válidos.
 * El mismo formato se valida en la base de datos (migración subject_icon_widths).
 */

export const ICON_SIZE = 100
export const MAX_ICON_LENGTH = 12000
/** Grosor de trazo por defecto, en unidades de la cuadrícula 0–100. */
export const DEFAULT_ICON_WIDTH = 8
export const MIN_ICON_WIDTH = 1
export const MAX_ICON_WIDTH = 30
// Alternancia plana (sin cuantificadores anidados): se comprueba en tiempo lineal.
export const ICON_PATTERN = /^(#[0-9a-f]{6}|c|w\d{1,2}|M\d{1,3} \d{1,3}|L\d{1,3} \d{1,3})*$/

export type Point = [number, number]
/** `color` null = color de la asignatura. */
export interface Stroke {
  color: string | null
  width: number
  points: Point[]
}

const clamp = (n: number) => Math.min(ICON_SIZE, Math.max(0, Math.round(n)))
const clampWidth = (n: number) => Math.min(MAX_ICON_WIDTH, Math.max(MIN_ICON_WIDTH, Math.round(n)))
const TOKEN = /#[0-9a-f]{6}|c|w(\d{1,2})|([ML])(\d{1,3}) (\d{1,3})/g

export function isValidIcon(icon: string): boolean {
  return icon.length <= MAX_ICON_LENGTH && ICON_PATTERN.test(icon)
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/.test(value)
}

export function serializeIcon(strokes: Stroke[]): string {
  let out = ''
  let current: string | null = null
  let currentWidth = DEFAULT_ICON_WIDTH
  for (const { color, width, points } of strokes) {
    if (!points.length) continue
    if (color !== current) {
      out += color ?? 'c'
      current = color
    }
    const w = clampWidth(width)
    if (w !== currentWidth) {
      out += `w${w}`
      currentWidth = w
    }
    const [first, ...rest] = points.map(([x, y]) => `${clamp(x)} ${clamp(y)}`)
    // Un toque suelto se guarda como segmento de longitud cero para que se vea como un punto.
    out += `M${first}${(rest.length ? rest : [first]).map((p) => `L${p}`).join('')}`
  }
  return out
}

export function parseIcon(icon: string | null | undefined): Stroke[] {
  if (!icon || !isValidIcon(icon)) return []
  const strokes: Stroke[] = []
  let color: string | null = null
  let width = DEFAULT_ICON_WIDTH
  for (const [token, w, cmd, x, y] of icon.matchAll(TOKEN)) {
    if (token === 'c') color = null
    else if (token.startsWith('#')) color = token
    else if (w !== undefined) width = clampWidth(Number(w))
    else if (cmd === 'M' || !strokes.length) strokes.push({ color, width, points: [[Number(x), Number(y)]] })
    else strokes[strokes.length - 1].points.push([Number(x), Number(y)])
  }
  return strokes
}

/** Trazados SVG listos para pintar: uno por cada tramo seguido del mismo color y grosor. */
export function iconPaths(icon: string | null | undefined): { color: string | null; width: number; d: string }[] {
  const runs: { color: string | null; width: number; d: string }[] = []
  for (const { color, width, points } of parseIcon(icon)) {
    const d = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('')
    const last = runs[runs.length - 1]
    if (last && last.color === color && last.width === width) last.d += d
    else runs.push({ color, width, d })
  }
  return runs
}
