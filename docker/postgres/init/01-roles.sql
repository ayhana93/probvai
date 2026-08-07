-- Начално вдигане на базата за ЛОКАЛНА РАЗРАБОТКА.
--
-- Пуска се веднъж, при първото стартиране на контейнера с Postgres.
-- Паролите тук са същите като в .env.example и нарочно не са тайна —
-- базата слуша само на localhost.
--
-- В production ролите се създават от миграцията (без парола), а паролите
-- се задават отделно с `npm run db:roles`.

-- CREATEROLE: миграцията създава трите работни роли.
-- CREATEDB:   `prisma migrate dev` прави временна сенчеста база, за да
--             провери новата миграция. В production не е нужно —
--             `prisma migrate deploy` не ползва сенчеста база.
CREATE ROLE probvai_migrator LOGIN PASSWORD 'migrator_dev' CREATEROLE CREATEDB;

CREATE ROLE app_user LOGIN PASSWORD 'app_user_dev';
CREATE ROLE app_system LOGIN PASSWORD 'app_system_dev';
CREATE ROLE app_admin LOGIN PASSWORD 'app_admin_dev';

CREATE DATABASE probvai OWNER probvai_migrator;
