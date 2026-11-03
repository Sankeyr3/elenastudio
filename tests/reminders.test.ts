import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, formatDate, isValidIsoDate, todayInMadrid } from '../shared/dates'
import { dueOffset, needsAttention, nextReminder, offsetsForExam, validateRules } from '../shared/reminders'
import { buildReminderNotification } from '../api/_lib/notification'
import { planReminders, type ExamRow } from '../api/_lib/plan'

describe('fechas', () => {
  it('calcula "hoy" en Europe/Madrid', () => {
    // 23:30 UTC del 31/12 ya es 1 de enero en Madrid (UTC+1 en invierno)
    expect(todayInMadrid(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01')
    // 22:30 UTC del 30/06 ya es 1 de julio en Madrid (UTC+2 en verano)
    expect(todayInMadrid(new Date('2026-06-30T22:30:00Z'))).toBe('2026-07-01')
    expect(todayInMadrid(new Date('2026-06-30T21:30:00Z'))).toBe('2026-06-30')
  })

  it('formatea DD/MM/AAAA y opera con días, también al cambiar la hora', () => {
    expect(formatDate('2026-03-05')).toBe('05/03/2026')
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30')
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2)
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2)
    expect(addDays('2026-11-10', -14)).toBe('2026-10-27')
  })

  it('valida fechas', () => {
    expect(isValidIsoDate('2026-02-29')).toBe(false)
    expect(isValidIsoDate('2028-02-29')).toBe(true)
    expect(isValidIsoDate('10/11/2026')).toBe(false)
  })
})

describe('plazos de aviso', () => {
  const rules = { offsets: [14, 7, 3, 1], hard_extra_days: 7 }

  it('añade un aviso adelantado a las asignaturas difíciles', () => {
    expect(offsetsForExam(2, rules)).toEqual([14, 7, 3, 1])
    expect(offsetsForExam(4, rules)).toEqual([21, 14, 7, 3, 1])
    expect(offsetsForExam(5, { ...rules, hard_extra_days: 0 })).toEqual([14, 7, 3, 1])
  })

  it('cada plazo cubre su ventana, y solo uno a la vez', () => {
    const offsets = [14, 7, 3, 1]
    expect(dueOffset(15, offsets)).toBeNull()
    expect(dueOffset(14, offsets)).toBe(14)
    expect(dueOffset(8, offsets)).toBe(14) // si el cron falló el día 14, se envía al día siguiente
    expect(dueOffset(7, offsets)).toBe(7)
    expect(dueOffset(5, offsets)).toBe(7) // examen añadido con 5 días: se envía el de 7 (uno solo)
    expect(dueOffset(3, offsets)).toBe(3)
    expect(dueOffset(1, offsets)).toBe(1)
    expect(dueOffset(0, offsets)).toBeNull() // el mismo día del examen ya no se avisa
    expect(dueOffset(0, [7, 0])).toBe(0)
  })

  it('calcula el siguiente aviso para el panel', () => {
    const today = '2026-10-22'
    // examen dentro de 10 días: el de 14 toca ya
    expect(nextReminder('2026-11-01', 10, [14, 7, 3, 1], new Set(), today)).toEqual({
      offset: 14,
      date: today,
      dueNow: true,
    })
    // ya enviado el de 14: el siguiente es el de 7, el 25/10
    expect(nextReminder('2026-11-01', 10, [14, 7, 3, 1], new Set([14]), today)).toEqual({
      offset: 7,
      date: '2026-10-25',
      dueNow: false,
    })
    expect(nextReminder('2026-10-23', 1, [14, 7, 3, 1], new Set([1]), today)).toBeNull()
  })

  it('valida las preferencias', () => {
    expect(validateRules(rules)).toBeNull()
    expect(validateRules({ offsets: [], hard_extra_days: 7 })).toMatch(/al menos/)
    expect(validateRules({ offsets: [7, 7], hard_extra_days: 7 })).toMatch(/repetidos/)
    expect(validateRules({ offsets: [100], hard_extra_days: 7 })).toMatch(/entre 0 y 90/)
  })

  it('marca qué requiere atención', () => {
    expect(needsAttention(2, 1)).toBe(true)
    expect(needsAttention(10, 5)).toBe(true)
    expect(needsAttention(10, 2)).toBe(false)
    expect(needsAttention(-1, 5)).toBe(false)
  })
})

const exam = (id: string, date: string, name: string, difficulty: number, note: string | null = null): ExamRow => ({
  id,
  exam_date: date,
  exam_time: null,
  note,
  subject: { name, difficulty, liking: null },
})

describe('planReminders + notificación', () => {
  const today = '2026-10-22'
  const exams = [
    exam('h', '2026-11-12', 'Historia', 5, 'Temas 1-4'), // 21 días, difícil -> aviso adelantado
    exam('d', '2026-11-05', 'Dibujo técnico', 1), // 14 días -> aviso inicial
    exam('m', '2026-10-25', 'Matemáticas', 3), // 3 días
    exam('i', '2026-10-27', 'Inglés', 2), // 5 días, ya pasó su aviso de 7 -> ventana de 7
    exam('f', '2026-10-30', 'Física', 2), // 8 días -> ventana de 14
    exam('p', '2026-10-20', 'Pasado', 2), // ya pasó
  ]

  it('elige los avisos de hoy y los exámenes de contexto', () => {
    const { due, upcoming } = planReminders(exams, { offsets: [14, 7, 3, 1], hard_extra_days: 7 }, today)
    expect(due.map((r) => [r.id, r.offset, r.hardExtra])).toEqual([
      ['m', 3, false],
      ['i', 7, false],
      ['f', 14, false],
      ['d', 14, false],
      ['h', 21, true],
    ])
    expect(upcoming.map((e) => e.id)).toEqual(['m', 'i', 'f', 'd', 'h'])
  })

  it('la notificación de un examen incluye fecha, dificultad y nota', () => {
    const { due } = planReminders(exams, { offsets: [14, 7, 3, 1], hard_extra_days: 7 }, today)
    const notification = buildReminderNotification({
      studentName: 'Elena',
      reminders: due.filter((r) => r.id === 'h'),
      appUrl: 'https://elenastudio.vercel.app',
    })
    expect(notification.title).toBe('Avisa a Elena: Historia en 21 días')
    expect(notification.body).toContain('jueves 12/11/2026. Asignatura difícil')
    expect(notification.body).toContain('Dificultad 5/5')
    expect(notification.body).toContain('Nota: Temas 1-4')
    expect(notification.url).toBe('https://elenastudio.vercel.app')
    expect(notification.tag).toBe('elenastudio-reminders')
  })

  it('con varios exámenes los resume en una sola notificación', () => {
    const { due } = planReminders(exams, { offsets: [14, 7, 3, 1], hard_extra_days: 7 }, today)
    const notification = buildReminderNotification({ studentName: 'Elena', reminders: due, appUrl: null })
    expect(notification.title).toBe('Avisa a Elena: 5 exámenes')
    expect(notification.body.split('\n')[0]).toBe('• Matemáticas: en 3 días (25/10/2026), dificultad 3/5')
    expect(notification.url).toBe('/')
  })

  it('la prueba sin exámenes lleva un texto genérico', () => {
    const notification = buildReminderNotification({ studentName: 'Elena', reminders: [], appUrl: null, test: true })
    expect(notification.title).toBe('[Prueba] ElenaStudio')
    expect(notification.body).toContain('recordar a Elena')
  })
})
