-- ============================================================================
-- РОЛИ, ПРАВА И ROW LEVEL SECURITY
-- ============================================================================
--
-- Модел на заплахата: ако потребителското приложение бъде пробито, атакуващият
-- получава връзката, с която то работи. Тази миграция гарантира, че тази
-- връзка физически не може да:
--   * промени баланс на кредити
--   * прочете чужд ред
--   * докосне одитния лог на админа
--   * види обработените Stripe събития
--
-- Четири роли:
--   probvai_migrator  собственик на таблиците, само за миграции
--   app_user          потребителското приложение, RLS реже редовете
--   app_system        Auth.js, webhook-ове, работници, cron
--   app_admin         админ панелът
--
-- ЗАБЕЛЕЖКА защо няма FORCE ROW LEVEL SECURITY:
-- RLS не важи за собственика на таблицата. Собственикът е probvai_migrator и
-- с него никога не се обслужват заявки — само миграции. Ако сложим FORCE,
-- бъдеща миграция, която пипа данни, ще засегне мълчаливо нула реда.
-- Затова: ENABLE (важи за app_user/app_system/app_admin), без FORCE.

-- ---------------------------------------------------------------------------
-- 1. Роли
-- ---------------------------------------------------------------------------
-- Създават се без парола и без право на вход. Операторът задава паролите
-- отделно (виж scripts/db-roles.ts и SETUP.md) — тайни в git няма.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_system') THEN
    CREATE ROLE app_system NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_admin') THEN
    CREATE ROLE app_admin NOLOGIN;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 2. Кой е текущият потребител
-- ---------------------------------------------------------------------------
-- Приложението задава стойността с
--   SELECT set_config('app.current_user_id', $1, TRUE)
-- в началото на всяка транзакция. TRUE значи „само за тази транзакция“,
-- за да не изтече стойността към следваща заявка на същата връзка от пула.
--
-- Ако стойността не е зададена, функцията връща NULL и всяко сравнение
-- `x = NULL` дава NULL — политиката не пуска нито един ред.
-- Отказът по подразбиране е правилният отказ.

CREATE OR REPLACE FUNCTION public.app_current_user_id() RETURNS text
  LANGUAGE sql
  STABLE
  PARALLEL SAFE
AS $$
  SELECT nullif(current_setting('app.current_user_id', true), '')
$$;

-- ---------------------------------------------------------------------------
-- 3. Базови права
-- ---------------------------------------------------------------------------

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;

GRANT USAGE ON SCHEMA public TO app_user, app_system, app_admin;

-- pg-boss създава собствена схема при първо стартиране.
DO $$
BEGIN
  EXECUTE format('GRANT CREATE ON DATABASE %I TO app_system', current_database());
END
$$;

-- ---------------------------------------------------------------------------
-- 4. users
-- ---------------------------------------------------------------------------
-- app_user НЯМА право да пише в `credits`, `risk_score`, `status`,
-- `free_credits_given`, `phone`, `email`. Това е правило №4 от заданието,
-- наложено от базата, а не от добрите намерения на кода.

GRANT SELECT ON TABLE public.users TO app_user;
GRANT UPDATE (name, image, default_photo_key, last_active_at, updated_at)
  ON TABLE public.users TO app_user;
GRANT ALL ON TABLE public.users TO app_system, app_admin;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_privileged ON public.users
  FOR ALL TO app_system, app_admin
  USING (true) WITH CHECK (true);

CREATE POLICY users_self ON public.users
  FOR ALL TO app_user
  USING (id = public.app_current_user_id())
  WITH CHECK (id = public.app_current_user_id());

-- ---------------------------------------------------------------------------
-- 5. accounts — OAuth връзки
-- ---------------------------------------------------------------------------
-- Съдържат access/refresh токени на Google/Apple/Facebook. app_user може да
-- види и да откачи своите, но създаването е работа на Auth.js (app_system).

GRANT SELECT, DELETE ON TABLE public.accounts TO app_user;
GRANT ALL ON TABLE public.accounts TO app_system, app_admin;

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY accounts_privileged ON public.accounts
  FOR ALL TO app_system, app_admin
  USING (true) WITH CHECK (true);

CREATE POLICY accounts_self ON public.accounts
  FOR ALL TO app_user
  USING (user_id = public.app_current_user_id())
  WITH CHECK (user_id = public.app_current_user_id());

-- ---------------------------------------------------------------------------
-- 6. sessions
-- ---------------------------------------------------------------------------

GRANT SELECT, DELETE ON TABLE public.sessions TO app_user;
GRANT ALL ON TABLE public.sessions TO app_system, app_admin;

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY sessions_privileged ON public.sessions
  FOR ALL TO app_system, app_admin
  USING (true) WITH CHECK (true);

CREATE POLICY sessions_self ON public.sessions
  FOR ALL TO app_user
  USING (user_id = public.app_current_user_id())
  WITH CHECK (user_id = public.app_current_user_id());

-- ---------------------------------------------------------------------------
-- 7. verification_tokens — magic link токени
-- ---------------------------------------------------------------------------
-- Четат се ПРЕДИ да има сесия, значи app_user няма работа тук изобщо.
-- Достъп до тази таблица = вход в чужд акаунт.

GRANT ALL ON TABLE public.verification_tokens TO app_system;
GRANT SELECT, DELETE ON TABLE public.verification_tokens TO app_admin;

ALTER TABLE public.verification_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY verification_tokens_privileged ON public.verification_tokens
  FOR ALL TO app_system, app_admin
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 8. credit_ledger — само за четене от приложението
-- ---------------------------------------------------------------------------
-- Редовете тук са одитната следа на парите. Никой освен app_system и
-- app_admin не пише в тях, и никой не ги трие или променя — затова
-- app_admin също получава само SELECT и INSERT.

GRANT SELECT ON TABLE public.credit_ledger TO app_user;
GRANT SELECT, INSERT ON TABLE public.credit_ledger TO app_system, app_admin;

ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY credit_ledger_privileged ON public.credit_ledger
  FOR ALL TO app_system, app_admin
  USING (true) WITH CHECK (true);

CREATE POLICY credit_ledger_self ON public.credit_ledger
  FOR SELECT TO app_user
  USING (user_id = public.app_current_user_id());

-- ---------------------------------------------------------------------------
-- 9. generations
-- ---------------------------------------------------------------------------
-- app_user чете своите и може да ги трие от гардероба. Създаването и
-- обновяването е работа на транзакцията за кредити и на работника.

GRANT SELECT, DELETE ON TABLE public.generations TO app_user;
GRANT ALL ON TABLE public.generations TO app_system, app_admin;

ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY generations_privileged ON public.generations
  FOR ALL TO app_system, app_admin
  USING (true) WITH CHECK (true);

CREATE POLICY generations_self ON public.generations
  FOR ALL TO app_user
  USING (user_id = public.app_current_user_id())
  WITH CHECK (user_id = public.app_current_user_id());

-- ---------------------------------------------------------------------------
-- 10. device_fingerprints — антифрод, невидими за приложението
-- ---------------------------------------------------------------------------

GRANT ALL ON TABLE public.device_fingerprints TO app_system;
GRANT SELECT ON TABLE public.device_fingerprints TO app_admin;

ALTER TABLE public.device_fingerprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY device_fingerprints_privileged ON public.device_fingerprints
  FOR ALL TO app_system, app_admin
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 11. deleted_identities — само хешове
-- ---------------------------------------------------------------------------

GRANT ALL ON TABLE public.deleted_identities TO app_system;
GRANT SELECT ON TABLE public.deleted_identities TO app_admin;

ALTER TABLE public.deleted_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY deleted_identities_privileged ON public.deleted_identities
  FOR ALL TO app_system, app_admin
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 12. processed_webhooks — идемпотентност на плащанията
-- ---------------------------------------------------------------------------
-- Заданието го иска изрично: app_user не вижда нищо, свързано с плащания.

GRANT ALL ON TABLE public.processed_webhooks TO app_system;
GRANT SELECT ON TABLE public.processed_webhooks TO app_admin;

ALTER TABLE public.processed_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY processed_webhooks_privileged ON public.processed_webhooks
  FOR ALL TO app_system, app_admin
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 13. admin_audit_log — недостъпен дори за app_system
-- ---------------------------------------------------------------------------
-- Одитният лог трябва да е недосегаем за системата, която одитира.
-- Само добавяне и четене, без UPDATE и без DELETE — за никого.

GRANT SELECT, INSERT ON TABLE public.admin_audit_log TO app_admin;

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_audit_log_admin ON public.admin_audit_log
  FOR ALL TO app_admin
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 14. support_tickets
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT ON TABLE public.support_tickets TO app_user;
GRANT ALL ON TABLE public.support_tickets TO app_system, app_admin;

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY support_tickets_privileged ON public.support_tickets
  FOR ALL TO app_system, app_admin
  USING (true) WITH CHECK (true);

CREATE POLICY support_tickets_self_read ON public.support_tickets
  FOR SELECT TO app_user
  USING (user_id = public.app_current_user_id());

CREATE POLICY support_tickets_self_write ON public.support_tickets
  FOR INSERT TO app_user
  WITH CHECK (user_id = public.app_current_user_id());

-- ---------------------------------------------------------------------------
-- 15. support_messages
-- ---------------------------------------------------------------------------
-- Вътрешните бележки (`internal = true`) са само за админ панела —
-- потребителката не ги вижда дори да познае id-то на съобщението.

GRANT SELECT, INSERT ON TABLE public.support_messages TO app_user;
GRANT ALL ON TABLE public.support_messages TO app_system, app_admin;

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY support_messages_privileged ON public.support_messages
  FOR ALL TO app_system, app_admin
  USING (true) WITH CHECK (true);

CREATE POLICY support_messages_self_read ON public.support_messages
  FOR SELECT TO app_user
  USING (
    internal = false
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_messages.ticket_id
        AND t.user_id = public.app_current_user_id()
    )
  );

CREATE POLICY support_messages_self_write ON public.support_messages
  FOR INSERT TO app_user
  WITH CHECK (
    internal = false
    AND author = 'USER'
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_messages.ticket_id
        AND t.user_id = public.app_current_user_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 16. Prisma миграционната таблица
-- ---------------------------------------------------------------------------
-- Приложението няма работа с историята на миграциите.

REVOKE ALL ON TABLE public._prisma_migrations FROM app_user, app_system, app_admin;
