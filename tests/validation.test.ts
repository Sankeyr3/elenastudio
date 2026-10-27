import { describe, expect, it } from 'vitest'
import { validateExam, validateSubjectName } from '../src/lib/validation'

const today = '2026-10-22'
const base = { subject_id: 's1', exam_date: '2026-11-10', exam_time: '', note: '' }

describe('validación de formularios', () => {
  it('acepta un examen mínimo (asignatura + fecha)', () => {
    expect(validateExam(base, today)).toEqual({})
    expect(validateExam({ ...base, exam_date: today }, today)).toEqual({})
  })

  it('exige asignatura y fecha válidas', () => {
    expect(validateExam({ ...base, subject_id: '', exam_date: '' }, today)).toEqual({
      subject_id: 'Elige una asignatura.',
      exam_date: 'Indica la fecha del examen.',
    })
    expect(validateExam({ ...base, exam_date: '2026-02-30' }, today).exam_date).toBe('La fecha no es válida.')
    expect(validateExam({ ...base, exam_date: '2028-01-01' }, today).exam_date).toMatch(/más de un año/)
  })

  it('no permite fechas pasadas salvo al editar un examen que ya la tenía', () => {
    expect(validateExam({ ...base, exam_date: '2026-10-01' }, today).exam_date).toBe('La fecha ya ha pasado.')
    expect(validateExam({ ...base, exam_date: '2026-10-01' }, today, '2026-10-01')).toEqual({})
  })

  it('valida hora y nota', () => {
    expect(validateExam({ ...base, exam_time: '09:30' }, today)).toEqual({})
    expect(validateExam({ ...base, exam_time: '25:00' }, today).exam_time).toBeDefined()
    expect(validateExam({ ...base, note: 'x'.repeat(501) }, today).note).toBeDefined()
  })

  it('valida nombres de asignatura', () => {
    const existing = [{ id: 'a', name: 'Historia' }]
    expect(validateSubjectName('  ', existing)).toMatch(/Escribe/)
    expect(validateSubjectName('historia ', existing)).toMatch(/Ya tienes/)
    expect(validateSubjectName('Historia', existing, 'a')).toBeNull()
    expect(validateSubjectName('Dibujo técnico', existing)).toBeNull()
  })
})
