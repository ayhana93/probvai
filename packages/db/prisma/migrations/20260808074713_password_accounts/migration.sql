-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password_hash" TEXT,
ADD COLUMN     "reset_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reset_locked_at" TIMESTAMP(3),
ADD COLUMN     "security_answer_hash" TEXT,
ADD COLUMN     "security_question" TEXT;

-- ============================================================================
-- ПРАВА ЗА НОВИТЕ КОЛОНИ
-- ============================================================================
--
-- Тук НЯМА `GRANT UPDATE`. Това не е пропуск.
--
-- Правата за писане върху `users` се дават колона по колона — в първата
-- миграция за име и снимка, във втората за профилните полета. Всяка колона,
-- която не е изброена там, е недостъпна за писане от приложението.
--
-- Значи `password_hash`, `security_answer_hash`, `reset_attempts` и
-- `reset_locked_at` могат да се пипат САМО от `app_system`. Пробив в
-- потребителската част не може да смени ничия парола и не може да нулира
-- брояча на опитите за възстановяване.
--
-- ЗА ЧЕТЕНЕТО: `app_user` има табличен SELECT върху `users`, значи вижда и
-- тези колони — но само СВОЯ ред, защото Row Level Security реже останалите.
-- Собственият хеш на паролата не дава на никого нищо ново.
--
-- Отнемането на четенето само за тези колони иска табличният SELECT да се
-- разпише колона по колона. Тогава всяка нова колона в схемата трябва да се
-- добавя и тук, а пропусне ли се веднъж — приложението пада с грешка, която
-- не сочи към причината. Затова: пази се писането, а четенето остава на RLS.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.column_privileges
    WHERE grantee = 'app_user'
      AND table_name = 'users'
      AND column_name IN ('password_hash', 'security_answer_hash')
      AND privilege_type = 'UPDATE'
  ) THEN
    RAISE NOTICE 'Добре: app_user няма право да пише в password_hash.';
  ELSE
    RAISE EXCEPTION 'app_user има UPDATE върху password_hash — това не бива.';
  END IF;
END
$$;
