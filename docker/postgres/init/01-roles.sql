-- Начално вдигане на базата за ЛОКАЛНА РАЗРАБОТКА.
--
-- Пуска се веднъж, при първото стартиране на контейнера с Postgres.
-- Паролите тук са същите като в .env.example и нарочно не са тайна —
-- базата слуша само на localhost.
--
-- В production ролите се създават от миграцията (без парола), а паролите
-- се задават отделно с `npm run db:roles`.

CREATE ROLE probvai_migrator LOGIN PASSWORD 'migrator_dev' CREATEROLE;

CREATE ROLE app_user LOGIN PASSWORD 'app_user_dev';
CREATE ROLE app_system LOGIN PASSWORD 'app_system_dev';
CREATE ROLE app_admin LOGIN PASSWORD 'app_admin_dev';

CREATE DATABASE probvai OWNER probvai_migrator;
