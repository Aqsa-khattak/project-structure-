import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import type { User } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

import { auth, db, isFirebaseConfigured } from "./firebase";
import type { UserProfile } from "./types";
import { bus } from "./state";
import { showToast } from "./cart";

/* ==========================================================================
   STATE
   ========================================================================== */

let currentUser: User | null = null;
let currentProfile: UserProfile | null = null;
let authReady = false;

export function getCurrentUser(): User | null {
  return currentUser;
}

export function getProfile(): UserProfile | null {
  return currentProfile;
}

export function isLoggedIn(): boolean {
  return currentUser !== null;
}

export function isAdmin(): boolean {
  return currentProfile?.role === "admin";
}

export function getDisplayName(): string {
  return currentProfile?.name || currentUser?.email?.split("@")[0] || "there";
}

/* ==========================================================================
   PROFILE DOCUMENT (users/{uid})
   ========================================================================== */

async function loadOrCreateProfile(user: User): Promise<UserProfile> {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return snap.data() as UserProfile;
  }

  const profile: UserProfile = {
    uid: user.uid,
    name: user.displayName ?? user.email?.split("@")[0] ?? "Shopper",
    email: user.email ?? "",
    role: "user", // promoted to "admin" only from the Firebase console or by an admin
    createdAt: Date.now(),
  };
  await setDoc(ref, profile);
  return profile;
}

/** Update the signed-in shopper's own name. */
export async function updateMyName(name: string): Promise<void> {
  if (!currentUser) return;
  await updateDoc(doc(db, "users", currentUser.uid), { name });
  await updateProfile(currentUser, { displayName: name });
  if (currentProfile) currentProfile.name = name;
  bus.emit("auth:change");
}

/* ==========================================================================
   INIT
   ========================================================================== */

/** Resolves once the first auth state callback has fired. */
export function initAuth(): Promise<void> {
  return new Promise((resolve) => {
    if (!isFirebaseConfigured) {
      authReady = true;
      bus.emit("auth:change");
      resolve();
      return;
    }

    // If Firebase can't be reached the app should still paint.
    const failsafe = setTimeout(() => {
      authReady = true;
      resolve();
    }, 6000);

    onAuthStateChanged(auth, async (user) => {
      clearTimeout(failsafe);
      currentUser = user;
      currentProfile = null;

      if (user) {
        try {
          currentProfile = await loadOrCreateProfile(user);
        } catch (err) {
          console.error("Could not load profile:", err);
        }
      }

      authReady = true;
      bus.emit("auth:change");
      resolve();
    });
  });
}

export function isAuthReady(): boolean {
  return authReady;
}

/* ==========================================================================
   ACTIONS
   ========================================================================== */

export async function signUp(name: string, email: string, password: string): Promise<void> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });

  const profile: UserProfile = {
    uid: cred.user.uid,
    name,
    email,
    role: "user",
    createdAt: Date.now(),
  };
  await setDoc(doc(db, "users", cred.user.uid), profile);
  currentProfile = profile;
}

export async function signIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(auth, new GoogleAuthProvider());
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

export async function logOut(): Promise<void> {
  await signOut(auth);
  currentUser = null;
  currentProfile = null;
  bus.emit("auth:change");
  showToast("Signed out");
}

/* ==========================================================================
   AUTH MODAL
   ========================================================================== */

type AuthMode = "login" | "signup";

/** Where to go once the shopper is signed in. */
let afterAuth: (() => void) | null = null;

export function openAuthModal(mode: AuthMode = "login", onSuccess?: () => void): void {
  afterAuth = onSuccess ?? null;
  const root = document.getElementById("auth-root");
  if (!root) return;

  root.innerHTML = `
    <div class="modal-overlay auth-overlay" id="authOverlay">
      <div class="auth-box">
        <button class="modal-close" id="authCloseBtn" aria-label="Close">✕</button>

        <div class="auth-tabs">
          <button class="auth-tab" data-mode="login">Sign in</button>
          <button class="auth-tab" data-mode="signup">Create account</button>
        </div>

        <form class="auth-form" id="authForm" novalidate>
          <div class="auth-field" id="nameField">
            <label for="authName">Name</label>
            <input type="text" id="authName" autocomplete="name" placeholder="Ayesha Khan" />
          </div>
          <div class="auth-field">
            <label for="authEmail">Email</label>
            <input type="email" id="authEmail" autocomplete="email" placeholder="you@example.com" required />
          </div>
          <div class="auth-field">
            <label for="authPassword">Password</label>
            <input type="password" id="authPassword" autocomplete="current-password" placeholder="At least 6 characters" required />
          </div>

          <p class="auth-error" id="authError"></p>

          <button type="submit" class="btn btn-primary btn-block" id="authSubmit">Sign in</button>
        </form>

        <button class="auth-link" id="forgotBtn" type="button">Forgot your password?</button>

        <div class="auth-divider"><span>or</span></div>

        <button class="btn btn-outline btn-block" id="googleBtn" type="button">Continue with Google</button>
      </div>
    </div>
  `;

  const overlay = document.getElementById("authOverlay")!;
  requestAnimationFrame(() => overlay.classList.add("open"));

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeAuthModal();
  });
  document.getElementById("authCloseBtn")!.addEventListener("click", closeAuthModal);
  document.addEventListener("keydown", onAuthEscape);

  root.querySelectorAll<HTMLButtonElement>(".auth-tab").forEach((tab) => {
    tab.addEventListener("click", () => setMode(tab.dataset.mode as AuthMode));
  });

  document.getElementById("authForm")!.addEventListener("submit", onSubmit);
  document.getElementById("googleBtn")!.addEventListener("click", onGoogle);
  document.getElementById("forgotBtn")!.addEventListener("click", onForgot);

  setMode(mode);
}

function setMode(mode: AuthMode): void {
  const nameField = document.getElementById("nameField");
  const submit = document.getElementById("authSubmit");
  const password = document.getElementById("authPassword") as HTMLInputElement | null;
  if (!nameField || !submit) return;

  document.querySelectorAll<HTMLButtonElement>(".auth-tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.mode === mode);
  });

  nameField.style.display = mode === "signup" ? "block" : "none";
  submit.textContent = mode === "signup" ? "Create account" : "Sign in";
  submit.dataset.mode = mode;
  if (password) {
    password.autocomplete = mode === "signup" ? "new-password" : "current-password";
  }
  setError("");
}

function setError(message: string): void {
  const el = document.getElementById("authError");
  if (el) el.textContent = message;
}

function setBusy(busy: boolean): void {
  const btn = document.getElementById("authSubmit") as HTMLButtonElement | null;
  if (!btn) return;
  btn.disabled = busy;
  btn.textContent = busy
    ? "Just a moment…"
    : btn.dataset.mode === "signup"
      ? "Create account"
      : "Sign in";
}

async function onSubmit(e: Event): Promise<void> {
  e.preventDefault();
  if (!guardConfigured()) return;

  const mode = (document.getElementById("authSubmit") as HTMLButtonElement).dataset.mode as AuthMode;
  const name = (document.getElementById("authName") as HTMLInputElement).value.trim();
  const email = (document.getElementById("authEmail") as HTMLInputElement).value.trim();
  const password = (document.getElementById("authPassword") as HTMLInputElement).value;

  if (mode === "signup" && name.length < 2) {
    setError("Enter your name so we know what to call you.");
    return;
  }
  if (!email.includes("@")) {
    setError("Enter a valid email address.");
    return;
  }
  if (password.length < 6) {
    setError("Passwords need at least 6 characters.");
    return;
  }

  setError("");
  setBusy(true);
  try {
    if (mode === "signup") {
      await signUp(name, email, password);
      showToast(`Welcome to Papernest, ${name}!`);
    } else {
      await signIn(email, password);
      showToast("Signed in");
    }
    finishAuth();
  } catch (err) {
    setError(friendlyError(err));
  } finally {
    setBusy(false);
  }
}

async function onGoogle(): Promise<void> {
  if (!guardConfigured()) return;
  try {
    await signInWithGoogle();
    showToast("Signed in");
    finishAuth();
  } catch (err) {
    setError(friendlyError(err));
  }
}

async function onForgot(): Promise<void> {
  if (!guardConfigured()) return;
  const email = (document.getElementById("authEmail") as HTMLInputElement).value.trim();
  if (!email.includes("@")) {
    setError("Type your email above first, then tap reset.");
    return;
  }
  try {
    await resetPassword(email);
    setError("");
    showToast("Password reset link sent to your inbox");
  } catch (err) {
    setError(friendlyError(err));
  }
}

function guardConfigured(): boolean {
  if (isFirebaseConfigured) return true;
  setError("Firebase isn't connected yet — add your project keys in src/firebase.ts.");
  return false;
}

function finishAuth(): void {
  const next = afterAuth;
  closeAuthModal();
  if (next) next();
}

function onAuthEscape(e: KeyboardEvent): void {
  if (e.key === "Escape") closeAuthModal();
}

export function closeAuthModal(): void {
  const overlay = document.getElementById("authOverlay");
  if (!overlay) return;
  overlay.classList.remove("open");
  document.removeEventListener("keydown", onAuthEscape);
  afterAuth = null;
  setTimeout(() => {
    const root = document.getElementById("auth-root");
    if (root) root.innerHTML = "";
  }, 250);
}

/** Run `action` if signed in, otherwise prompt for sign-in first. */
export function requireAuth(action: () => void, message = "Sign in to continue"): void {
  if (isLoggedIn()) {
    action();
    return;
  }
  showToast(message);
  openAuthModal("login", action);
}

/* ==========================================================================
   ERRORS
   ========================================================================== */

const ERROR_TEXT: Record<string, string> = {
  "auth/email-already-in-use": "That email already has an account — try signing in.",
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/weak-password": "Pick a password with at least 6 characters.",
  "auth/user-not-found": "No account found for that email.",
  "auth/wrong-password": "That password doesn't match. Try again.",
  "auth/invalid-credential": "Email or password is incorrect.",
  "auth/too-many-requests": "Too many attempts. Wait a minute and try again.",
  "auth/popup-closed-by-user": "The Google window closed before sign-in finished.",
  "auth/network-request-failed": "Network trouble — check your connection.",
};

function friendlyError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  return ERROR_TEXT[code] ?? "Something went wrong. Please try again.";
}
