-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "GenSource" AS ENUM ('UPLOAD', 'LINK');

-- CreateEnum
CREATE TYPE "StyleCategory" AS ENUM ('BUSINESS', 'STREETWEAR', 'LUXURY', 'SUMMER', 'ELEGANT', 'CUTE', 'GYM', 'WEDDING', 'PARTY', 'CASUAL', 'DATE');

-- AlterTable
ALTER TABLE "generations" ADD COLUMN     "category" "StyleCategory",
ADD COLUMN     "category_locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "like_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "person_gender" "Gender",
ADD COLUMN     "product_url" TEXT,
ADD COLUMN     "published_at" TIMESTAMP(3),
ADD COLUMN     "saved_at" TIMESTAMP(3),
ADD COLUMN     "source" "GenSource" NOT NULL DEFAULT 'UPLOAD';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "birth_year" INTEGER,
ADD COLUMN     "first_name" TEXT,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "last_name" TEXT,
ADD COLUMN     "lifetime_spend_cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "profile_completed_at" TIMESTAMP(3),
ADD COLUMN     "wardrobe_public" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "xp" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "look_likes" (
    "user_id" TEXT NOT NULL,
    "generation_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "look_likes_pkey" PRIMARY KEY ("user_id","generation_id")
);

-- CreateTable
CREATE TABLE "look_saves" (
    "user_id" TEXT NOT NULL,
    "generation_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "look_saves_pkey" PRIMARY KEY ("user_id","generation_id")
);

-- CreateIndex
CREATE INDEX "look_likes_generation_id_idx" ON "look_likes"("generation_id");

-- CreateIndex
CREATE INDEX "look_saves_user_id_created_at_idx" ON "look_saves"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "generations_published_at_category_idx" ON "generations"("published_at", "category");

-- AddForeignKey
ALTER TABLE "look_likes" ADD CONSTRAINT "look_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "look_likes" ADD CONSTRAINT "look_likes_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "generations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "look_saves" ADD CONSTRAINT "look_saves_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "look_saves" ADD CONSTRAINT "look_saves_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "generations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- ПРАВА И ROW LEVEL SECURITY ЗА НОВОТО
-- ============================================================================
--
-- Всяка нова таблица тръгва БЕЗ права. Ако този блок липсваше, приложението
-- щеше да пада с „permission denied" — и това е правилният отказ по
-- подразбиране. Нова таблица без политика не бива да е четима.

-- ---------------------------------------------------------------------------
-- 1. Нови колони в users
-- ---------------------------------------------------------------------------
-- Правило №4 остава: app_user НЯМА UPDATE върху `credits`. Няма го и върху
-- `xp` и `lifetime_spend_cents` — те са производни на парите и се пипат само
-- от системната роля. Иначе всеки може да си напише VIP статус.
--
-- Профилът е негов и той го пише сам: име, фамилия, пол, година на раждане,
-- видимост на гардероба.

GRANT UPDATE (
  first_name,
  last_name,
  gender,
  birth_year,
  wardrobe_public,
  profile_completed_at
) ON TABLE public.users TO app_user;

-- ---------------------------------------------------------------------------
-- 2. generations — новите колони
-- ---------------------------------------------------------------------------
-- app_user вече има SELECT и DELETE. Сега получава и UPDATE, но само върху
-- полетата, които са негово решение: категорията, свалянето в галерията и
-- публикуването в Lookbook.
--
-- НЕ получава `like_count` — броячът е чужд резултат и се пипа само от
-- системната роля. Иначе всеки може да си сложи хиляда харесвания.

GRANT UPDATE (category, category_locked, saved_at, published_at)
  ON TABLE public.generations TO app_user;

-- ---------------------------------------------------------------------------
-- 3. look_likes
-- ---------------------------------------------------------------------------
-- Човек пише и трие СВОИТЕ харесвания. Чуждите не вижда изобщо — броят
-- харесвания идва от кеша `generations.like_count`, а не от четене на
-- таблицата. Така „кой е харесал" остава невидимо: това е галерия, не
-- социална мрежа.

GRANT SELECT, INSERT, DELETE ON TABLE public.look_likes TO app_user;
GRANT ALL ON TABLE public.look_likes TO app_system, app_admin;

ALTER TABLE public.look_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY look_likes_privileged ON public.look_likes
  FOR ALL TO app_system, app_admin
  USING (true) WITH CHECK (true);

CREATE POLICY look_likes_self ON public.look_likes
  FOR ALL TO app_user
  USING (user_id = public.app_current_user_id())
  WITH CHECK (user_id = public.app_current_user_id());

-- ---------------------------------------------------------------------------
-- 4. look_saves
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, DELETE ON TABLE public.look_saves TO app_user;
GRANT ALL ON TABLE public.look_saves TO app_system, app_admin;

ALTER TABLE public.look_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY look_saves_privileged ON public.look_saves
  FOR ALL TO app_system, app_admin
  USING (true) WITH CHECK (true);

CREATE POLICY look_saves_self ON public.look_saves
  FOR ALL TO app_user
  USING (user_id = public.app_current_user_id())
  WITH CHECK (user_id = public.app_current_user_id());

-- ---------------------------------------------------------------------------
-- 5. ЗАЩО НЯМА ПОЛИТИКА „ЧЕТИ ЧУЖДИТЕ ПУБЛИКУВАНИ ВИЗИИ"
-- ---------------------------------------------------------------------------
--
-- Изкушението е една политика:
--
--   CREATE POLICY generations_public ON public.generations
--     FOR SELECT TO app_user USING (published_at IS NOT NULL);
--
-- Тя обаче отваря ЦЕЛИЯ ред, не само снимката. Правата в Postgres са на
-- колона и на таблица, не на политика — с нея app_user би виждал чуждите
-- `person_key`, `cost_usd`, `provider_job_id` и `error_code`.
--
-- Затова Lookbook се чете през системната роля, през ЕДНА функция —
-- packages/core/src/lookbook.ts — която избира точно колоните за показване.
-- Един одитиран път е по-лесен за проверка от една широка политика.
