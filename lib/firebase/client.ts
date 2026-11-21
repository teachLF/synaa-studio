'use client';

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GithubAuthProvider,
  GoogleAuthProvider,
  isSignInWithEmailLink,
  OAuthProvider,
  sendEmailVerification,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore, type Firestore } from 'firebase/firestore';
import bundledConfig from '@/firebase-applet-config.json';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

// Allow Vercel / GitHub deployments to override config via standard NEXT_PUBLIC_* env vars
// while working out-of-the-box with firebase-applet-config.json.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || bundledConfig.apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || bundledConfig.authDomain,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || bundledConfig.projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || bundledConfig.storageBucket,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || bundledConfig.messagingSenderId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || bundledConfig.appId,
};

const firestoreDatabaseId =
  process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_DATABASE_ID || bundledConfig.firestoreDatabaseId;

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;
let connectionTested = false;

export function getFirebaseServices(): { app: FirebaseApp; auth: Auth; db: Firestore } {
  if (!cachedApp) {
    cachedApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  if (!cachedAuth) {
    cachedAuth = getAuth(cachedApp);
  }
  if (!cachedDb) {
    cachedDb = firestoreDatabaseId
      ? getFirestore(cachedApp, firestoreDatabaseId)
      : getFirestore(cachedApp);
  }
  if (!connectionTested && typeof window !== 'undefined') {
    connectionTested = true;
    testConnection(cachedDb);
  }
  return { app: cachedApp, auth: cachedAuth, db: cachedDb };
}

export async function testConnection(dbInstance?: Firestore): Promise<void> {
  try {
    const targetDb = dbInstance || getFirebaseServices().db;
    await getDocFromServer(doc(targetDb, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('يرجى التحقق من إعدادات اتصال Firebase.');
    }
  }
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const currentAuth = cachedAuth;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentAuth?.currentUser?.uid,
      email: currentAuth?.currentUser?.email,
      emailVerified: currentAuth?.currentUser?.emailVerified,
      isAnonymous: currentAuth?.currentUser?.isAnonymous,
      tenantId: currentAuth?.currentUser?.tenantId,
      providerInfo:
        currentAuth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const EMAIL_LINK_STORAGE_KEY = 'cinestudio_email_for_signin';

export async function signInWithGoogle() {
  const { auth } = getFirebaseServices();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(auth, provider);
}

export async function signInWithApple() {
  const { auth } = getFirebaseServices();
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  return signInWithPopup(auth, provider);
}

export async function signInWithGitHub() {
  const { auth } = getFirebaseServices();
  const provider = new GithubAuthProvider();
  provider.addScope('user:email');
  return signInWithPopup(auth, provider);
}

export async function sendPasswordlessEmailLink(email: string): Promise<void> {
  const trimmed = email.trim();
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new Error('يرجى إدخال عنوان بريد إلكتروني صحيح');
  }
  const { auth } = getFirebaseServices();
  const redirectUrl = typeof window !== 'undefined' ? window.location.origin : '';
  await sendSignInLinkToEmail(auth, trimmed, {
    url: redirectUrl,
    handleCodeInApp: true,
  });
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(EMAIL_LINK_STORAGE_KEY, trimmed);
  }
}

export async function completeEmailLinkSignInIfNeeded(
  fallbackEmailPrompt?: () => string | null
): Promise<User | null> {
  if (typeof window === 'undefined') return null;
  const { auth } = getFirebaseServices();
  const href = window.location.href;
  if (!isSignInWithEmailLink(auth, href)) return null;

  let email = window.localStorage.getItem(EMAIL_LINK_STORAGE_KEY) || '';
  if (!email && fallbackEmailPrompt) {
    email = fallbackEmailPrompt() || '';
  }
  if (!email) {
    throw new Error('NEED_EMAIL_FOR_LINK');
  }

  const cred = await signInWithEmailLink(auth, email, href);
  window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
  const cleanUrl = window.location.origin + window.location.pathname;
  window.history.replaceState({}, document.title, cleanUrl);
  return cred.user;
}

export async function resendAccountVerification(user: User): Promise<void> {
  await sendEmailVerification(user);
}

export async function signOutAccount(): Promise<void> {
  const { auth } = getFirebaseServices();
  await signOut(auth);
}

export function translateFirebaseAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg === 'NEED_EMAIL_FOR_LINK') {
    return 'يرجى كتابة بريدك الإلكتروني لإكمال التحقق من الرابط.';
  }
  if (msg.includes('auth/popup-closed-by-user')) {
    return 'تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية.';
  }
  if (msg.includes('auth/popup-blocked')) {
    return 'حظر المتصفح النافذة المنبثقة — يرجى السماح بالنوافذ المنبثقة ثم المحاولة مرة أخرى.';
  }
  if (msg.includes('auth/operation-not-allowed')) {
    return 'مزود الدخول هذا غير مفعّل حالياً في Firebase Console. يرجى تفعيله من Authentication → Sign-in method.';
  }
  if (msg.includes('auth/unauthorized-domain') || msg.includes('auth/unauthorized-continue-uri')) {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    return `النطاق الحالي (${host}) غير مضاف في Authorized domains داخل Firebase Authentication → Settings.`;
  }
  if (msg.includes('auth/account-exists-with-different-credential')) {
    return 'هذا البريد مسجل بالفعل بطريقة دخول أخرى (مثل جوجل أو البريد). سجل الدخول بالطريقة السابقة.';
  }
  if (msg.includes('auth/invalid-email')) {
    return 'صيغة البريد الإلكتروني غير صحيحة.';
  }
  if (msg.includes('auth/invalid-action-code') || msg.includes('auth/expired-action-code')) {
    return 'رابط التحقق منتهي الصلاحية أو مستخدم مسبقاً. يرجى طلب رابط جديد.';
  }
  if (msg.includes('Quota exceeded')) {
    return 'تم تجاوز الحصة المجانية اليومية لقاعدة البيانات — تتجدد الحصة غداً.';
  }
  return msg || 'تعذر إتمام تسجيل الدخول. يرجى المحاولة مرة أخرى.';
}
