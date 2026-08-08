-- Любими проби в гардероба.
--
-- Отделно от `saved_at`, което значи „свалена в галерията на телефона".
-- Едното е събитие, другото — предпочитание; един филтър върху двете рано
-- или късно показва грешното.

ALTER TABLE "generations" ADD COLUMN "favorited_at" TIMESTAMP(3);

-- Правото се дава изрично, колона по колона — както за всички останали.
GRANT UPDATE (favorited_at) ON TABLE public.generations TO app_user;

-- Филтърът „Любими" чете само своите редове (RLS) и подрежда по дата.
-- Частичният индекс държи в себе си единствено отбелязаните — а те са малка
-- част от гардероба.
CREATE INDEX "generations_favorited_idx"
  ON public.generations (user_id, favorited_at DESC)
  WHERE favorited_at IS NOT NULL;
