import { collection, doc, getDocs, updateDoc } from "firebase/firestore";

import { db } from "./firebase";
import type { UserProfile, UserRole } from "./types";

export async function getAllUsers(): Promise<UserProfile[]> {
  const snap = await getDocs(collection(db, "users"));
  const list: UserProfile[] = [];
  snap.forEach((d) => list.push(d.data() as UserProfile));
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export async function setUserRole(uid: string, role: UserRole): Promise<void> {
  await updateDoc(doc(db, "users", uid), { role });
}
