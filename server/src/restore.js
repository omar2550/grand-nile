import 'dotenv/config';
import mongoose from 'mongoose';
import path from 'path';
import { readBackup } from './backup.js';

// Usage: npm run restore -- backups/backup-2026-10-31T03-00-00-auto.json
const file = process.argv[2];
if (!file) { console.log('Tell me which backup file to restore, for example:\n  npm run restore -- backups/backup-....json'); process.exit(1); }
await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/grand_nile');
const data = readBackup(path.resolve(file));
console.log('This will REPLACE all current data with the backup. Starting in 5 seconds… (Ctrl+C to stop)');
await new Promise((r) => setTimeout(r, 5000));
for (const [name, docs] of Object.entries(data)) {
  const col = mongoose.connection.db.collection(name); await col.deleteMany({});
  for (let i = 0; i < docs.length; i += 1000) await col.insertMany(docs.slice(i, i + 1000));
  console.log(`  restored ${name}: ${docs.length}`);
}
console.log('Restore finished.'); await mongoose.disconnect();
