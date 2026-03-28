import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, getDoc, onSnapshot, query, where, deleteDoc, updateDoc, getDocFromServer } from "firebase/firestore";

import firebaseConfig from "../firebase-applet-config.json";

// Check if config is valid
const isConfigValid = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('REPLACE_WITH');

// Initialize Firebase
let app;
try {
  if (isConfigValid) {
    app = initializeApp(firebaseConfig);
  } else {
    console.warn("Firebase configuration is missing or invalid. Please check your firebase-applet-config.json file.");
    // Initialize with dummy app to prevent crashes, but it won't work
    app = initializeApp({
      apiKey: "dummy-key",
      projectId: "dummy-project",
      appId: "dummy-app-id"
    });
  }
} catch (e) {
  console.error("Firebase initialization failed:", e);
  app = initializeApp({
    apiKey: "dummy-key",
    projectId: "dummy-project",
    appId: "dummy-app-id"
  });
}

export const auth = getAuth(app);
// Use the specific database ID from the config if it exists
export const db = (firebaseConfig as any).firestoreDatabaseId 
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Auth helper
export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logOut = () => signOut(auth);

// Error handling helper
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
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();
