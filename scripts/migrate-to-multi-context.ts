/**
 * Migration: legacy single-institution model -> multi-context model
 * (households + generalized institution membership), decided 2026-09-17.
 *
 * Run ONCE, against a backup, before deploying the new firestore.rules.
 * Safe to re-run (idempotent): every step checks "already migrated" before
 * writing.
 *
 * Usage:
 *   npx tsx scripts/migrate-to-multi-context.ts --dry-run   (default, no writes)
 *   npx tsx scripts/migrate-to-multi-context.ts --apply     (writes for real)
 */
import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

if (!admin.apps.length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    });
  } else {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
}

const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

function log(...args: any[]) {
  console.log(APPLY ? '[APPLY]' : '[DRY-RUN]', ...args);
}

// --- Step 1: Plan simplification (3 tiers -> 2 tiers) -----------------------
// BASIC/INTERMEDIATE/ADVANCED (personal, no prefix) and the old
// *_INTERMEDIATE/*_ADVANCED variants collapse into just *_BASIC / *_PLUS.
// INTERMEDIATE is treated as PLUS (product decision: don't downgrade
// someone who was paying for a mid-tier plan) — confirm this mapping
// against your actual pricing history before running --apply.
const PLAN_MIGRATION_MAP: Record<string, string> = {
  BASIC: 'PERSONAL_BASIC',
  INTERMEDIATE: 'PERSONAL_PLUS',
  ADVANCED: 'PERSONAL_PLUS',
  PERSONAL_INTERMEDIATE: 'PERSONAL_PLUS',
  PERSONAL_ADVANCED: 'PERSONAL_PLUS',
  INSTITUTION_INTERMEDIATE: 'INSTITUTION_PLUS',
  INSTITUTION_ADVANCED: 'INSTITUTION_PLUS',
};

async function migrateInstitutionPlans() {
  const snapshot = await db.collection('institutions').get();
  let changed = 0;
  for (const doc of snapshot.docs) {
    const current = doc.data().planType;
    const mapped = PLAN_MIGRATION_MAP[current];
    if (mapped && mapped !== current) {
      log(`institutions/${doc.id}.planType: ${current} -> ${mapped}`);
      if (APPLY) await doc.ref.update({ planType: mapped });
      changed++;
    }
  }
  log(`Institutions plan migration: ${changed} of ${snapshot.size} updated.`);
}

async function migrateSubscriptionPlans() {
  const snapshot = await db.collection('subscriptions').get();
  let changed = 0;
  for (const doc of snapshot.docs) {
    const current = doc.data().planType;
    const mapped = PLAN_MIGRATION_MAP[current];
    if (mapped && mapped !== current) {
      log(`subscriptions/${doc.id}.planType: ${current} -> ${mapped}`);
      if (APPLY) await doc.ref.update({ planType: mapped });
      changed++;
    }
  }
  log(`Subscription plan migration: ${changed} of ${snapshot.size} updated.`);
}

// --- Step 2: institutionId (single field) -> institutions/{id}/members/{uid}
async function migrateUserInstitutionMemberships() {
  const snapshot = await db.collection('users').get();
  let created = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const institutionId = data.institutionId;
    if (!institutionId) continue;

    const memberRef = db.collection('institutions').doc(institutionId).collection('members').doc(doc.id);
    const existingMember = await memberRef.get();
    if (existingMember.exists) continue; // already migrated

    const role = data.role && ['ADMIN', 'MANAGER', 'MEMBER'].includes(data.role) ? data.role : 'MEMBER';
    log(`Creating institutions/${institutionId}/members/${doc.id} (role=${role}) from legacy users/${doc.id}.institutionId`);
    if (APPLY) {
      await memberRef.set({
        institutionId,
        userId: doc.id,
        role,
        status: 'ACTIVE',
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    created++;
  }
  log(`Institution membership backfill: ${created} member docs created.`);
}

// --- Step 3: give every existing personal user a Household of their own ----
// so the "profile switcher" always has at least one entry, and so existing
// personal-pillar data (which stays owner-scoped either way) has somewhere
// to attach future shared items to, without asking them to re-onboard.
async function backfillPersonalHouseholds() {
  const snapshot = await db.collection('users')
    .where('type', 'in', ['personal', null])
    .get();
  let created = 0;
  for (const doc of snapshot.docs) {
    const existingAsOwner = await db.collection('households').where('ownerId', '==', doc.id).limit(1).get();
    if (!existingAsOwner.empty) continue; // already has one

    const data = doc.data();
    const householdRef = db.collection('households').doc();
    const inviteCode = householdRef.id.slice(0, 8).toUpperCase();
    log(`Creating household ${householdRef.id} ("Família ${data.name || doc.id}") for users/${doc.id}`);
    if (APPLY) {
      await householdRef.set({
        id: householdRef.id,
        name: `Família ${data.name || ''}`.trim(),
        ownerId: doc.id,
        inviteCode,
        planType: 'PERSONAL_BASIC', // safe default; reconcile with subscriptions/{uid} separately if they're already paying
        subscriptionStatus: 'TRIAL',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await householdRef.collection('members').doc(doc.id).set({
        householdId: householdRef.id,
        userId: doc.id,
        profileName: data.name || 'Dono(a)',
        role: 'OWNER',
        permissions: ['ASSIGN_TASKS_TO_OTHERS', 'APPROVE_TASKS', 'VIEW_FINANCE', 'MANAGE_FINANCE', 'MANAGE_MEMBERS'],
        status: 'ACTIVE',
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    created++;
  }
  log(`Personal household backfill: ${created} households created.`);
}

async function main() {
  log('Starting migration. Pass --apply to write for real; default is dry-run.');
  await migrateInstitutionPlans();
  await migrateSubscriptionPlans();
  await migrateUserInstitutionMemberships();
  await backfillPersonalHouseholds();
  log('Done.');
  if (!APPLY) {
    console.log('\nNothing was written. Re-run with --apply once this output looks right.');
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
