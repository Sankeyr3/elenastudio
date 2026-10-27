-- Iconos con varios colores: además de "M x y" / "L x y", se admiten "#rrggbb" (color de los trazos
-- siguientes) y "c" (volver al color de la asignatura). Ver shared/icon.ts. Los iconos existentes siguen siendo válidos.
alter table elenastudy.subjects
  drop constraint subjects_icon_check,
  add constraint subjects_icon_check check (
    char_length(icon) <= 12000
    and icon ~ '^(#[0-9a-f]{6}|c|M[0-9]{1,3} [0-9]{1,3}|L[0-9]{1,3} [0-9]{1,3})*$'
  );
