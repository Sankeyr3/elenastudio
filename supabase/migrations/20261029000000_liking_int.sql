-- "¿Te gusta?" pasa de enum a número, en la misma escala 1–5 que la dificultad:
--   1 = poco · 3 = sin más (antes "regular") · 5 = mucho
-- Los huecos (2 y 4) permiten añadir niveles intermedios sin otra migración.
alter table elenastudio.subjects
  alter column liking type smallint using (
    case liking::text when 'poco' then 1 when 'regular' then 3 when 'mucho' then 5 end
  );
alter table elenastudio.subjects
  add constraint subjects_liking_check check (liking between 1 and 5);

drop type elenastudio.liking;

notify pgrst, 'reload schema';
