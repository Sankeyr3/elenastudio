import { describe, expect, it } from 'vitest'
import { iconPaths, isValidIcon, parseIcon, serializeIcon, type Stroke } from '../shared/icon'

describe('iconos dibujados', () => {
  it('convierte trazos de varios colores en texto y vuelta', () => {
    const strokes: Stroke[] = [
      { color: null, width: 8, points: [[10, 20], [30, 40]] },
      { color: '#000000', width: 8, points: [[50, 50]] },
      { color: '#000000', width: 8, points: [[1, 2], [3, 4]] },
      { color: null, width: 8, points: [[5, 5], [6, 6]] },
    ]
    const icon = serializeIcon(strokes)
    expect(icon).toBe('M10 20L30 40#000000M50 50L50 50M1 2L3 4cM5 5L6 6')
    expect(parseIcon(icon)).toEqual([
      { color: null, width: 8, points: [[10, 20], [30, 40]] },
      { color: '#000000', width: 8, points: [[50, 50], [50, 50]] },
      { color: '#000000', width: 8, points: [[1, 2], [3, 4]] },
      { color: null, width: 8, points: [[5, 5], [6, 6]] },
    ])
  })

  it('agrupa en un trazado SVG los tramos seguidos del mismo color', () => {
    expect(iconPaths('#ff0000M1 1L2 2M3 3L4 4#00ff00M5 5L6 6')).toEqual([
      { color: '#ff0000', width: 8, d: 'M1 1L2 2M3 3L4 4' },
      { color: '#00ff00', width: 8, d: 'M5 5L6 6' },
    ])
  })

  it('guarda el grosor solo cuando cambia', () => {
    const strokes: Stroke[] = [
      { color: null, width: 8, points: [[1, 1], [2, 2]] },
      { color: null, width: 4, points: [[3, 3], [4, 4]] },
      { color: '#000000', width: 4, points: [[5, 5], [6, 6]] },
      { color: '#000000', width: 99, points: [[7, 7], [8, 8]] },
    ]
    const icon = serializeIcon(strokes)
    expect(icon).toBe('M1 1L2 2w4M3 3L4 4#000000M5 5L6 6w30M7 7L8 8')
    expect(parseIcon(icon).map((s) => s.width)).toEqual([8, 4, 4, 30])
    expect(iconPaths(icon).map((r) => r.width)).toEqual([8, 4, 4, 30])
  })

  it('los iconos antiguos de un solo color siguen funcionando', () => {
    expect(parseIcon('M10 20L30 40')).toEqual([{ color: null, width: 8, points: [[10, 20], [30, 40]] }])
  })

  it('redondea y limita las coordenadas a la cuadrícula', () => {
    expect(serializeIcon([{ color: null, width: 8, points: [[-5, 10.6], [120, 99.4]] }])).toBe('M0 11L100 99')
  })

  it('sin trazos, el icono queda vacío', () => {
    expect(serializeIcon([])).toBe('')
    expect(parseIcon(null)).toEqual([])
  })

  it('rechaza cualquier cosa que no sea el formato permitido', () => {
    expect(isValidIcon('#a1b2c3M1 2L3 4cw12M5 6')).toBe(true)
    expect(isValidIcon('w123M1 2')).toBe(false)
    expect(isValidIcon('M1 2C3 4 5 6 7 8')).toBe(false)
    expect(isValidIcon('#FFFFFFM1 2')).toBe(false)
    expect(isValidIcon('"/><script>')).toBe(false)
    expect(parseIcon('<svg>')).toEqual([])
  })
})
