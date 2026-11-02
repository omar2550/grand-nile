import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
const DIR = path.resolve('backups');
const EJSON = () => mongoose.mongo.BSON.EJSON;

/** Saves every collection (all hotels) into one timestamped file on the server's disk. */
export async function runBackup(label = 'auto') {
  fs.mkdirSync(DIR, { recursive: true });
  const out = {};
  for (const c of await mongoose.connection.db.listCollections().toArray()) out[c.name] = await mongoose.connection.db.collection(c.name).find().toArray();
  const name = `backup-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}-${label}.json`;
  fs.writeFileSync(path.join(DIR, name), EJSON().stringify(out, { relaxed: false }));
  const files = fs.readdirSync(DIR).sort(); // keep the 30 newest
  files.slice(0, Math.max(0, files.length - 30)).forEach((f) => fs.unlinkSync(path.join(DIR, f)));
  return name;
}
export const listBackups = () => fs.existsSync(DIR)
  ? fs.readdirSync(DIR).sort().reverse().map((n) => ({ name: n, sizeKB: Math.round(fs.statSync(path.join(DIR, n)).size / 1024), at: fs.statSync(path.join(DIR, n)).mtime })) : [];
export const backupPath = (n) => path.join(DIR, path.basename(n));
export const readBackup = (file) => EJSON().parse(fs.readFileSync(file, 'utf8'), { relaxed: false });
