import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  updateDoc,
  doc,
  where,
} from "firebase/firestore";

import { db } from "./firebase";
import { getCurrentUser, getProfile } from "./auth";
import { cart, getCartTotal } from "./state";
import type { Order, OrderLine, OrderStatus } from "./types";

const COLLECTION = "orders";

export interface CheckoutDetails {
  phone: string;
  address: string;
}

export async function placeOrder(details: CheckoutDetails): Promise<string> {
  const user = getCurrentUser();
  if (!user) throw new Error("not-signed-in");
  if (!cart.length) throw new Error("empty-cart");

  const items: OrderLine[] = cart.map((item) => ({
    id: item.product.id,
    title: item.product.title,
    price: item.product.price,
    image: item.product.image,
    quantity: item.quantity,
  }));

  const payload = {
    userId: user.uid,
    userName: getProfile()?.name ?? user.displayName ?? "Shopper",
    userEmail: user.email ?? "",
    phone: details.phone,
    address: details.address,
    items,
    total: getCartTotal(),
    status: "pending" as OrderStatus,
    createdAt: Date.now(),
  };

  const ref = await addDoc(collection(db, COLLECTION), payload);
  return ref.id;
}

/** Orders belonging to the signed-in shopper, newest first. */
export async function getMyOrders(): Promise<Order[]> {
  const user = getCurrentUser();
  if (!user) return [];

  const snap = await getDocs(
    query(collection(db, COLLECTION), where("userId", "==", user.uid))
  );
  const list: Order[] = [];
  snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<Order, "id">) }));
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

/** Every order in the shop — admin only (enforced by Firestore rules). */
export async function getAllOrders(): Promise<Order[]> {
  const snap = await getDocs(
    query(collection(db, COLLECTION), orderBy("createdAt", "desc"))
  );
  const list: Order[] = [];
  snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<Order, "id">) }));
  return list;
}

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  await updateDoc(doc(db, COLLECTION, orderId), { status });
}

export const ORDER_STATUSES: OrderStatus[] = ["pending", "shipped", "delivered", "cancelled"];
