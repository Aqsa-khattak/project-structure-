import { doc, getDoc, setDoc } from "firebase/firestore";

import { db, isFirebaseConfigured } from "./firebase";
import { bus, cart, replaceCart, switchCartOwner } from "./state";
import { getProductById } from "./productsService";
import type { Product } from "./types";

const COLLECTION = "carts";

interface RemoteCartLine {
  productId: number;
  quantity: number;
}

let syncUid: string | null = null;

export async function setCartOwner(uid: string | null): Promise<void> {
  if (!uid) {
    syncUid = null;
    switchCartOwner(null);
    return;
  }

  const guestLines: RemoteCartLine[] = cart.map((item) => ({
    productId: item.product.id,
    quantity: item.quantity,
  }));

  syncUid = uid;
  switchCartOwner(uid); 

  if (!isFirebaseConfigured) return;

  try {
    const snap = await getDoc(doc(db, COLLECTION, uid));
    const remoteLines: RemoteCartLine[] = snap.exists() ? (snap.data().items ?? []) : [];

    const merged = new Map<number, number>();
    const addLines = (lines: RemoteCartLine[]) => {
      lines.forEach((line) => merged.set(line.productId, (merged.get(line.productId) ?? 0) + line.quantity));
    };
    addLines(remoteLines);
    addLines(guestLines);
    cart.forEach((item) => addLines([{ productId: item.product.id, quantity: item.quantity }]));

    if (syncUid !== uid) return; 

    const resolved: { product: Product; quantity: number }[] = [];
    merged.forEach((quantity, productId) => {
      const product = getProductById(productId);
      if (product) resolved.push({ product, quantity });
    });

    replaceCart(resolved);
  } catch (err) {
    console.error("Could not load your cart:", err);
  }
}

bus.on("cart:change", () => {
  if (!syncUid || !isFirebaseConfigured) return;
  void pushCart(syncUid);
});

async function pushCart(uid: string): Promise<void> {
  try {
    const items: RemoteCartLine[] = cart.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
    }));
    await setDoc(doc(db, COLLECTION, uid), { items, updatedAt: Date.now() });
  } catch (err) {
    console.error("Could not sync cart:", err);
  }
}
