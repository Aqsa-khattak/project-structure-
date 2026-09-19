import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  writeBatch,
} from "firebase/firestore";

import { db, isFirebaseConfigured } from "./firebase";
import { productsData } from "./productsData";
import type { Product } from "./types";
import { bus } from "./state";

const COLLECTION = "products";

let catalog: Product[] = [...productsData];
let usingLocalCatalog = true;
let loaded = false;

export function getAllProducts(): Product[] {
  return catalog;
}

export function getProductById(id: number): Product | undefined {
  return catalog.find((p) => p.id === id);
}

export function isUsingLocalCatalog(): boolean {
  return usingLocalCatalog;
}

export function isCatalogLoaded(): boolean {
  return loaded;
}

/** Read the catalog from Firestore once at start-up. */
export async function loadProducts(): Promise<void> {
  loaded = true;
  if (!isFirebaseConfigured) return;

  try {
    const snap = await getDocs(collection(db, COLLECTION));
    if (snap.empty) return; // nothing imported yet — keep the bundled list

    const list: Product[] = [];
    snap.forEach((d) => list.push(d.data() as Product));
    list.sort((a, b) => a.id - b.id);

    catalog = list;
    usingLocalCatalog = false;
    bus.emit("products:change");
  } catch (err) {
    console.error("Falling back to the bundled catalog:", err);
  }
}

/* ==========================================================================
   ADMIN WRITES
   ========================================================================== */

/** Copy the bundled catalog into Firestore so it becomes editable. */
export async function importBundledCatalog(): Promise<number> {
  const CHUNK = 400; // Firestore allows 500 writes per batch
  for (let i = 0; i < productsData.length; i += CHUNK) {
    const batch = writeBatch(db);
    productsData.slice(i, i + CHUNK).forEach((p) => {
      batch.set(doc(db, COLLECTION, String(p.id)), p);
    });
    await batch.commit();
  }
  await reload();
  return productsData.length;
}

export async function saveProduct(product: Product): Promise<void> {
  await setDoc(doc(db, COLLECTION, String(product.id)), product);
  await reload();
}

export async function deleteProduct(id: number): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, String(id)));
  await reload();
}

/** Next free id, so new products never clash with the bundled ones. */
export function nextProductId(): number {
  return catalog.reduce((max, p) => Math.max(max, p.id), 0) + 1;
}

async function reload(): Promise<void> {
  const snap = await getDocs(collection(db, COLLECTION));
  const list: Product[] = [];
  snap.forEach((d) => list.push(d.data() as Product));
  list.sort((a, b) => a.id - b.id);
  catalog = list.length ? list : [...productsData];
  usingLocalCatalog = list.length === 0;
  bus.emit("products:change");
}
