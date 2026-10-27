-- Color de cada asignatura en el calendario. Los valores coinciden con SUBJECT_COLORS (shared/colors.ts).
-- Si es null, la app asigna uno automáticamente.
alter table estudion.subjects
  add column color text check (
    color in ('indigo', 'sky', 'teal', 'emerald', 'lime', 'amber', 'orange', 'rose', 'pink', 'violet', 'slate')
  );
