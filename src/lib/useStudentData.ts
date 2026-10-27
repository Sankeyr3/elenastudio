import { useCallback, useEffect, useMemo, useState } from 'react'
import { todayInMadrid } from '../../shared/dates'
import { friendlyError } from './errors'
import { supabase } from './supabase'
import type { Exam, ExamWithSubject, Subject } from './types'

/** Asignaturas y exámenes de una estudiante. Lo usan tanto Elena como el ayudante (solo lectura por RLS). */
export function useStudentData(studentId: string) {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setError(null)
    const [subjectsRes, examsRes] = await Promise.all([
      supabase.from('subjects').select('id, name, difficulty, liking, color, icon').eq('student_id', studentId).order('name'),
      supabase
        .from('exams')
        .select('id, subject_id, exam_date, exam_time, note')
        .eq('student_id', studentId)
        .order('exam_date')
        .order('exam_time'),
    ])
    if (subjectsRes.error || examsRes.error) {
      setError(friendlyError(subjectsRes.error ?? examsRes.error))
    } else {
      setSubjects(subjectsRes.data as Subject[])
      setExams(examsRes.data as Exam[])
    }
    setLoading(false)
  }, [studentId])

  useEffect(() => {
    void reload()
  }, [reload])

  const today = todayInMadrid()
  const withSubjects = useMemo(() => {
    const byId = new Map(subjects.map((s) => [s.id, s]))
    return exams.flatMap((e): ExamWithSubject[] => {
      const subject = byId.get(e.subject_id)
      return subject ? [{ ...e, subject }] : []
    })
  }, [exams, subjects])

  const upcoming = withSubjects.filter((e) => e.exam_date >= today)
  const past = withSubjects.filter((e) => e.exam_date < today).reverse()

  return { subjects, exams: withSubjects, upcoming, past, today, loading, error, reload }
}
