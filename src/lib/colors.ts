import type { SubjectColor } from '../../shared/colors'

/** Clases de Tailwind por color (escritas completas para que Tailwind las detecte). */
export const COLOR_CLASSES: Record<SubjectColor, { dot: string; chip: string; outline: string; text: string }> = {
  indigo: { dot: 'bg-indigo-600', chip: 'bg-indigo-600 text-white', outline: 'outline-indigo-600', text: 'text-indigo-600' },
  sky: { dot: 'bg-sky-500', chip: 'bg-sky-500 text-white', outline: 'outline-sky-500', text: 'text-sky-500' },
  teal: { dot: 'bg-teal-600', chip: 'bg-teal-600 text-white', outline: 'outline-teal-600', text: 'text-teal-600' },
  emerald: { dot: 'bg-emerald-600', chip: 'bg-emerald-600 text-white', outline: 'outline-emerald-600', text: 'text-emerald-600' },
  lime: { dot: 'bg-lime-500', chip: 'bg-lime-500 text-black', outline: 'outline-lime-500', text: 'text-lime-600' },
  amber: { dot: 'bg-amber-400', chip: 'bg-amber-400 text-black', outline: 'outline-amber-400', text: 'text-amber-600' },
  orange: { dot: 'bg-orange-500', chip: 'bg-orange-500 text-white', outline: 'outline-orange-500', text: 'text-orange-500' },
  rose: { dot: 'bg-rose-600', chip: 'bg-rose-600 text-white', outline: 'outline-rose-600', text: 'text-rose-600' },
  pink: { dot: 'bg-pink-500', chip: 'bg-pink-500 text-white', outline: 'outline-pink-500', text: 'text-pink-500' },
  violet: { dot: 'bg-violet-600', chip: 'bg-violet-600 text-white', outline: 'outline-violet-600', text: 'text-violet-600' },
  slate: { dot: 'bg-slate-500', chip: 'bg-slate-500 text-white', outline: 'outline-slate-500', text: 'text-slate-500' },
}
