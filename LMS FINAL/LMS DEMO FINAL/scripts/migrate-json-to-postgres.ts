import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { initPostgres, seedPostgresFromStore } from '../server/db/postgresEngine';
import { loadJsonStoreFromPath } from '../server/db/jsonEngine';
import { repairDatabaseIntegrity, migratePlaintextPasswords } from '../server/dbIntegrity';

async function main() {
  const jsonPath = process.argv[2] || path.join(process.cwd(), 'db.json');

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required. Example:');
    console.error('postgresql://skillfort:skillfort_dev@localhost:5432/skillfort_lms');
    process.exit(1);
  }

  if (!fs.existsSync(jsonPath)) {
    console.error(`File not found: ${jsonPath}`);
    process.exit(1);
  }

  const store = loadJsonStoreFromPath(jsonPath);
  repairDatabaseIntegrity(store);
  await migratePlaintextPasswords(store);

  await initPostgres();
  await seedPostgresFromStore(store);

  console.log(`✅ Migrated ${jsonPath} to PostgreSQL`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
