/** 1 = le gusta poco ... 5 = le gusta mucho (misma escala que la dificultad). */
export type Liking = number

export const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Me cuesta muy poco',
  2: 'Me cuesta poco',
  3: 'Normal',
  4: 'Me cuesta bastante',
  5: 'Me cuesta muchísimo',
}

export const LIKING_LABELS: Record<Liking, string> = {
  1: 'Le gusta poco',
  3: 'Le gusta sin más',
  5: 'Le gusta mucho',
}
