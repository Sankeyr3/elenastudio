/** Colores que se pueden asignar a una asignatura (deben coincidir con la migración subject_color). */
export const SUBJECT_COLORS = [
  'indigo',
  'sky',
  'teal',
  'emerald',
  'lime',
  'amber',
  'orange',
  'rose',
  'pink',
  'violet',
  'slate',
] as const

export type SubjectColor = (typeof SUBJECT_COLORS)[number]

export const SUBJECT_COLOR_LABELS: Record<SubjectColor, string> = {
  indigo: 'Índigo',
  sky: 'Celeste',
  teal: 'Turquesa',
  emerald: 'Verde',
  lime: 'Lima',
  amber: 'Ámbar',
  orange: 'Naranja',
  rose: 'Rojo',
  pink: 'Rosa',
  violet: 'Violeta',
  slate: 'Gris',
}

export function isSubjectColor(value: unknown): value is SubjectColor {
  return typeof value === 'string' && (SUBJECT_COLORS as readonly string[]).includes(value)
}

/** Color efectivo: el elegido o, si no hay, uno estable derivado del id. */
export function subjectColor(subject: { id: string; color?: string | null }): SubjectColor {
  if (isSubjectColor(subject.color)) return subject.color
  let hash = 0
  for (const ch of subject.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return SUBJECT_COLORS[hash % (SUBJECT_COLORS.length - 1)] // nunca gris por defecto
}

/** Primer color que aún no usa ninguna otra asignatura (para proponerlo al crear una nueva). */
export function firstFreeColor(used: { id: string; color?: string | null }[]): SubjectColor {
  const taken = new Set(used.map(subjectColor))
  return SUBJECT_COLORS.find((c) => !taken.has(c)) ?? SUBJECT_COLORS[0]
}
