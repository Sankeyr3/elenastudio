export type Liking = 'mucho' | 'regular' | 'poco'

export const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Me cuesta muy poco',
  2: 'Me cuesta poco',
  3: 'Normal',
  4: 'Me cuesta bastante',
  5: 'Me cuesta muchísimo',
}

export const LIKING_LABELS: Record<Liking, string> = {
  mucho: 'Le gusta mucho',
  regular: 'Le gusta regular',
  poco: 'Le gusta poco',
}
