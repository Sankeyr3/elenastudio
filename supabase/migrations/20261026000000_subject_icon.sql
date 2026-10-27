-- Icono dibujado a mano para cada asignatura (opcional).
-- Formato: trazado SVG restringido a "M x y" y "L x y" con enteros de 0 a 100 (ver shared/icon.ts).
alter table elenastudy.subjects
  add column icon text check (
    char_length(icon) <= 12000
    and icon ~ '^(M[0-9]{1,3} [0-9]{1,3}(L[0-9]{1,3} [0-9]{1,3})*)*$'
  );
