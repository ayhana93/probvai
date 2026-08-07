-- CreateTable
CREATE TABLE "phone_verifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "phone_verifications_user_id_created_at_idx" ON "phone_verifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "phone_verifications_expires_at_idx" ON "phone_verifications"("expires_at");

-- AddForeignKey
ALTER TABLE "phone_verifications" ADD CONSTRAINT "phone_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- ПРАВА И RLS ЗА phone_verifications
-- ============================================================================
-- Таблицата пази хеша на еднократния код. Ако приложението може да я чете,
-- сравняването на кода става безсмислено — затова достъп има само app_system.

GRANT ALL ON TABLE public.phone_verifications TO app_system;
GRANT SELECT ON TABLE public.phone_verifications TO app_admin;

ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY phone_verifications_privileged ON public.phone_verifications
  FOR ALL TO app_system, app_admin
  USING (true) WITH CHECK (true);

-- ============================================================================
-- ПАЗАЧИ НА ЛЕДЖЕРА
-- ============================================================================
-- Двата индекса по-долу правят двойното начисляване физически невъзможно.
-- Кодът така или иначе проверява преди да пише, но проверка и запис са две
-- отделни действия — между тях може да се промъкне втора заявка. Уникалният
-- индекс не може да бъде промъкнат.

-- Еднократните подаръци се дават по веднъж на потребител. Точка.
CREATE UNIQUE INDEX credit_ledger_one_time_grants
  ON public.credit_ledger (user_id, reason)
  WHERE reason IN ('SIGNUP', 'EMAIL_VERIFY', 'PHONE_VERIFY');

-- Един кредит на генерация, едно връщане на генерация, едно начисляване на
-- Stripe плащане. Дори webhook да дойде два пъти, вторият запис пада.
CREATE UNIQUE INDEX credit_ledger_ref_once
  ON public.credit_ledger (reason, ref_id)
  WHERE ref_id IS NOT NULL AND reason IN ('GENERATION', 'REFUND', 'PURCHASE');
