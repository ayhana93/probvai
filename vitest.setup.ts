import { existsSync } from 'node:fs';

// Тестовете работят срещу истинска Postgres база — RLS и `SELECT ... FOR UPDATE`
// не могат да се проверят срещу подставка.
if (existsSync('.env.test')) {
  process.loadEnvFile('.env.test');
} else if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

if (!process.env.DATABASE_URL_APP || !process.env.DATABASE_URL_SYSTEM) {
  throw new Error(
    'Тестовете искат DATABASE_URL_APP и DATABASE_URL_SYSTEM. ' +
      'Копирай .env.example като .env и пусни: npm run db:setup',
  );
}
