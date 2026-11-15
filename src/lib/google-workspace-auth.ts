"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  GoogleAuthProvider,
  browserPopupRedirectResolver,
  browserSessionPersistence,
  getAuth,
  getRedirectResult,
  inMemoryPersistence,
  initializeAuth,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth,
  type User,
  type UserCredential,
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";
import { isSameOriginAuthHost } from "./workspace-auth-error";

export const WORKSPACE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/spreadsheets",
] as const;

export interface GoogleWorkspaceUser {
  uid: string;
  displayName: string | null;
  email: string | null;
}

function toWorkspaceUser(user: User): GoogleWorkspaceUser {
  return {
    uid: user.uid,
    displayName: user.displayName ?? null,
    email: user.email ?? null,
  };
}

export function isInEmbeddedFrame(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function shouldUseSameOriginAuthProxy(): boolean {
  if (typeof window === "undefined") return false;
  return isSameOriginAuthHost(window.location.hostname);
}

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;

function getClientAuth(): Auth | null {
  if (typeof window === "undefined") return null;
  if (cachedAuth) return cachedAuth;

  const runtimeConfig = shouldUseSameOriginAuthProxy()
    ? { ...firebaseConfig, authDomain: window.location.host }
    : firebaseConfig;

  cachedApp = getApps().length > 0 ? getApp() : initializeApp(runtimeConfig);
  try {
    cachedAuth = initializeAuth(cachedApp, {
      popupRedirectResolver: browserPopupRedirectResolver,
      persistence: [browserSessionPersistence, inMemoryPersistence],
    });
  } catch {
    // If Firebase Auth was already initialized on this app instance, reuse it.
    cachedAuth = getAuth(cachedApp);
  }
  return cachedAuth;
}

function createGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  for (const scope of WORKSPACE_SCOPES) {
    provider.addScope(scope);
  }
  provider.setCustomParameters({ prompt: "consent" });
  return provider;
}

let isSigningIn = false;
// Access token is kept strictly in memory (never in localStorage/sessionStorage).
let cachedAccessToken: string | null = null;
let redirectResultPromise: Promise<UserCredential | null> | null = null;

function resolveRedirectOnce(auth: Auth): Promise<UserCredential | null> {
  if (!redirectResultPromise) {
    redirectResultPromise = getRedirectResult(auth, browserPopupRedirectResolver);
  }
  return redirectResultPromise;
}

export function initGoogleAuth(
  onAuthSuccess?: (
    user: GoogleWorkspaceUser,
    token: string,
    meta?: { fromRedirect?: boolean },
  ) => void,
  onAuthFailure?: (user: GoogleWorkspaceUser | null) => void,
  onAuthError?: (error: unknown) => void,
): () => void {
  const auth = getClientAuth();
  if (!auth) {
    return () => {};
  }

  let active = true;

  void resolveRedirectOnce(auth)
    .then((result) => {
      if (!active || !result) return;
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        onAuthError?.(new Error("تعذّر الحصول على إذن الوصول من Google. حاول مرة أخرى."));
        return;
      }
      cachedAccessToken = credential.accessToken;
      onAuthSuccess?.(toWorkspaceUser(result.user), cachedAccessToken, {
        fromRedirect: true,
      });
    })
    .catch((error) => {
      if (!active) return;
      onAuthError?.(error);
    });

  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (!active) return;
    const safeUser = user ? toWorkspaceUser(user) : null;
    if (safeUser && cachedAccessToken) {
      onAuthSuccess?.(safeUser, cachedAccessToken);
      return;
    }
    if (!isSigningIn) {
      cachedAccessToken = null;
      onAuthFailure?.(safeUser);
    }
  });

  return () => {
    active = false;
    unsubscribe();
  };
}

export async function googleSignIn(): Promise<{
  user: GoogleWorkspaceUser;
  accessToken: string;
} | null> {
  const auth = getClientAuth();
  if (!auth) {
    throw new Error("تسجيل الدخول متاح داخل المتصفح فقط.");
  }

  isSigningIn = true;
  try {
    // In a standalone tab on a hosted domain, use same-origin redirect auth
    // so Chrome COOP on Google Sign-In never prematurely closes/invalidates a popup.
    if (shouldUseSameOriginAuthProxy() && !isInEmbeddedFrame()) {
      await signInWithRedirect(auth, createGoogleProvider(), browserPopupRedirectResolver);
      return null;
    }

    const result = await signInWithPopup(
      auth,
      createGoogleProvider(),
      browserPopupRedirectResolver,
    );
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("تعذّر الحصول على إذن الوصول من Google. حاول مرة أخرى.");
    }
    cachedAccessToken = credential.accessToken;
    return {
      user: toWorkspaceUser(result.user),
      accessToken: cachedAccessToken,
    };
  } finally {
    isSigningIn = false;
  }
}

export function getGoogleAccessToken(): string | null {
  return cachedAccessToken;
}

export function clearGoogleAccessToken(): void {
  cachedAccessToken = null;
}

export async function googleLogout(): Promise<void> {
  cachedAccessToken = null;
  redirectResultPromise = null;
  const auth = getClientAuth();
  if (auth) {
    await signOut(auth);
  }
}

export { parseSpreadsheetId } from "./sheet-utils";
