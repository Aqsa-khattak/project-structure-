import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";

import { db, isFirebaseConfigured } from "./firebase";
import { bus } from "./state";
import { getAllProducts } from "./productsService";
import type { Product } from "./types";

const STORAGE_PREFIX = "papernest_favourites_";

let owner = "guest";
let syncUid: string | null = null; 

let ids = new Set<number>(loadLocal());

function storageKey(): string {
  return STORAGE_PREFIX + owner;
}

function loadLocal(): number[] {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}

function persistLocal(): void {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(Array.from(ids)));
  } catch {
    
  }
}

/* ==========================================================================
   READ
   ========================================================================== */

export function isFavourite(productId: number): boolean {
  return ids.has(productId);
}

export function getFavouriteIds(): number[] {
  return Array.from(ids);
}

export function getFavouriteCount(): number {
  return ids.size;
}

export function getFavouriteProducts(): Product[] {
  return getAllProducts().filter((p) => ids.has(p.id));
}

/* ==========================================================================
   WRITE
   ========================================================================== */

/** Add or remove a product. Returns the new state (true = now saved). */
export function toggleFavourite(productId: number): boolean {
  const nowSaved = !ids.has(productId);
  if (nowSaved) ids.add(productId);
  else ids.delete(productId);

  persistLocal();
  bus.emit("favourites:change");
  void syncOne(productId, nowSaved);
  return nowSaved;
}

export function clearFavourites(): void {
  const previous = Array.from(ids);
  ids.clear();
  persistLocal();
  bus.emit("favourites:change");
  previous.forEach((id) => void syncOne(id, false));
}

async function syncOne(productId: number, saved: boolean): Promise<void> {
  if (!syncUid || !isFirebaseConfigured) return;
  const ref = doc(db, "users", syncUid, "favourites", String(productId));
  try {
    if (saved) await setDoc(ref, { productId, savedAt: Date.now() });
    else await deleteDoc(ref);
  } catch (err) {
    console.error("Could not sync favourite:", err);
  }
}

/* ==========================================================================
   SWITCH ACCOUNT
   ========================================================================== */

export function setFavouritesOwner(uid: string | null): void {
  if (!uid) {
    syncUid = null;
    owner = "guest";
    ids = new Set<number>(loadLocal());
    bus.emit("favourites:change");
    return;
  }

  const guestIds = owner === "guest" ? Array.from(ids) : [];

  syncUid = uid;
  owner = uid;
  ids = new Set<number>(loadLocal());
  guestIds.forEach((id) => ids.add(id));
  persistLocal();
  bus.emit("favourites:change");

  void pullFromFirestore(uid, guestIds);
}

async function pullFromFirestore(uid: string, guestIds: number[]): Promise<void> {
  if (!isFirebaseConfigured) return;

  try {
    const snap = await getDocs(collection(db, "users", uid, "favourites"));
    const remote = new Set<number>();
    snap.forEach((d) => remote.add(Number(d.id)));

    const localOnly = Array.from(ids).filter((id) => !remote.has(id));
    localOnly.forEach((id) => remote.add(id));

    if (syncUid !== uid) return; // account changed again while this was loading

    ids = remote;
    persistLocal();
    bus.emit("favourites:change");

    await Promise.all(localOnly.map((id) => syncOne(id, true)));
  } catch (err) {
    console.error("Could not load favourites:", err);
  }
}
