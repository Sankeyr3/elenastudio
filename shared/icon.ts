/**
 * Iconos dibujados a mano, sobre una cuadrícula de 0 a 100. Se guardan como texto con estos elementos:
 *   "#rrggbb"  los trazos siguientes van en ese color
 *   "c"        los trazos siguientes van en el color de la asignatura (es el valor inicial)
 *   "M x y"    empieza un trazo   ·   "L x y"  lo continúa (enteros)
 * Ejemplo: "M10 20L30 40#000000M50 50L50 50". Los iconos sin colores (solo M/L) siguen siendo válidos.
 * El mismo formato se valida en la base de datos (migración subject_icon_colors).
 */

export const ICON_SIZE = 100
export const MAX_ICON_LENGTH = 12000
// Alternancia plana (sin cuantificadores anidados): se comprueba en tiempo lineal.
export const ICON_PATTERN = /^(#[0-9a-f]{6}|c|M\d{1,3} \d{1,3}|L\d{1,3} \d{1,3})*$/

export type Point = [number, number]
/** `color` null = color de la asignatura. */
export interface Stroke {
  color: string | null
  points: Point[]
}

const clamp = (n: number) => Math.min(ICON_SIZE, Math.max(0, Math.round(n)))
const TOKEN = /#[0-9a-f]{6}|c|([ML])(\d{1,3}) (\d{1,3})/g

export function isValidIcon(icon: string): boolean {
  return icon.length <= MAX_ICON_LENGTH && ICON_PATTERN.test(icon)
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/.test(value)
}

export function serializeIcon(strokes: Stroke[]): string {
  let out = ''
  let current: string | null = null
  for (const { color, points } of strokes) {
    if (!points.length) continue
    if (color !== current) {
      out += color ?? 'c'
      current = color
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
  for (const [token, cmd, x, y] of icon.matchAll(TOKEN)) {
    if (token === 'c') color = null
    else if (token.startsWith('#')) color = token
    else if (cmd === 'M' || !strokes.length) strokes.push({ color, points: [[Number(x), Number(y)]] })
    else strokes[strokes.length - 1].points.push([Number(x), Number(y)])
  }
  return strokes
}

/** Trazados SVG listos para pintar: uno por cada tramo seguido del mismo color. */
export function iconPaths(icon: string | null | undefined): { color: string | null; d: string }[] {
  const runs: { color: string | null; d: string }[] = []
  for (const { color, points } of parseIcon(icon)) {
    const d = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('')
    const last = runs[runs.length - 1]
    if (last && last.color === color) last.d += d
    else runs.push({ color, d })
  }
  return runs
}
