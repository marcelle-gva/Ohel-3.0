import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

async function backupCollection(collectionName) {
  console.log(`Backing up collection: ${collectionName}...`);
  const snapshot = await db.collection(collectionName).get();
  const data = {};
  snapshot.forEach(doc => {
    data[doc.id] = doc.data();
  });
  return data;
}

async function runBackup() {
  try {
    const collections = ['users', 'tasks', 'subscriptions', 'audit_logs', 'notifications', 'finance_transactions', 'spiritual_devotionals', 'spiritual_reading_plans'];
    const backup = {};

    for (const collection of collections) {
      backup[collection] = await backupCollection(collection);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, '../backups');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }

    const filePath = path.join(backupDir, `firestore-backup-${timestamp}.json`);
    fs.writeFileSync(filePath, JSON.stringify(backup, null, 2));

    console.log(`Backup completed successfully! Saved to ${filePath}`);
  } catch (error) {
    console.error('Backup failed:', error);
    process.exit(1);
  }
}

runBackup();
