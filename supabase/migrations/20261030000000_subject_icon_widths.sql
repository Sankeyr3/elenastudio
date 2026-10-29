-- Iconos con grosor de trazo: además de lo anterior, se admite "wN" (grosor de los trazos siguientes).
-- Ver shared/icon.ts. Los iconos existentes siguen siendo válidos (grosor por defecto).
alter table elenastudio.subjects
  drop constraint subjects_icon_check,
  add constraint subjects_icon_check check (
    char_length(icon) <= 12000
    and icon ~ '^(#[0-9a-f]{6}|c|w[0-9]{1,2}|M[0-9]{1,3} [0-9]{1,3}|L[0-9]{1,3} [0-9]{1,3})*$'
  );
