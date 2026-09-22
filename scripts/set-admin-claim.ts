import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin with smarter credential detection
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('Firebase Admin initialized with service account from ENV.');
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
      console.log('Firebase Admin initialized with application default credentials.');
    }
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }
}

const targetEmail = process.argv[2] || process.env.ADMIN_EMAIL || 'marcelle.gomesvieira.ayres@gmail.com';

async function setAdminClaim(email: string) {
  try {
    console.log(`[Admin Script] Looking up user by email: ${email}...`);
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log(`[Admin Script] User found: ${userRecord.uid} (${userRecord.email})`);

    // Existing claims
    const existingClaims = userRecord.customClaims || {};
    console.log('[Admin Script] Existing custom claims:', existingClaims);

    // Set admin custom claim
    const newClaims = {
      ...existingClaims,
      admin: true,
      role: 'ADMIN'
    };

    await admin.auth().setCustomUserClaims(userRecord.uid, newClaims);
    console.log(`[Admin Script] Successfully set custom claims { admin: true, role: 'ADMIN' } on UID: ${userRecord.uid}`);

    // Synchronize Firestore user document
    const db = admin.firestore();
    const userRef = db.collection('users').doc(userRecord.uid);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      await userRef.update({
        isPlatformAdmin: true,
        role: 'ADMIN',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('[Admin Script] Firestore users document updated with isPlatformAdmin: true');
    } else {
      await userRef.set({
        id: userRecord.uid,
        email: userRecord.email,
        name: userRecord.displayName || 'Admin Master',
        role: 'ADMIN',
        type: 'personal',
        isPlatformAdmin: true,
        activeModules: ['matrix', 'focus', 'personal', 'financial', 'family', 'professional', 'spiritual'],
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      console.log('[Admin Script] Firestore users document created with isPlatformAdmin: true');
    }

    console.log(`\n======================================================`);
    console.log(`✅ SUCESSO! O usuário ${email} agora é Plataform Admin.`);
    console.log(`Custom Claims atualizados:`, newClaims);
    console.log(`Na próxima autenticação ou ao atualizar o token (getIdToken(true)),`);
    console.log(`as regras do Firestore validarão request.auth.token.admin == true.`);
    console.log(`======================================================\n`);
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      console.error(`\n❌ Erro: Usuário com o e-mail "${email}" não encontrado no Firebase Auth.`);
      console.error(`Por favor, realize o cadastro do usuário primeiro ou verifique a digitação.`);
    } else {
      console.error('\n❌ Erro ao definir custom claims:', error.message || error);
    }
    process.exit(1);
  }
}

setAdminClaim(targetEmail).then(() => {
  process.exit(0);
});
