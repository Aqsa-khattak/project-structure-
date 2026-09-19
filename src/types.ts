export interface Product {
  id: number;
  title: string;
  price: number;
  image: string;
  category: string | string[];
  subCategory: string | string[];
  inStock: boolean;
  description?: string[]; 
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type ViewName = "home" | "shop" | "wishlist" | "account" | "admin";

export type SortOption =
  | "featured"
  | "price-asc"
  | "price-desc"
  | "name-asc"
  | "name-desc";

export interface ShopFilters {
  category: string | null;
  subCategory: string | null;
  search: string;
  sort: SortOption;
  minPrice: number | null;
  maxPrice: number | null;
  inStockOnly: boolean;
  page: number;
}

export interface CategoryDef {
  slug: string;
  label: string;
  match: string[];
  image?: string;
}

/* ==========================================================================
   AUTH / ROLES
   ========================================================================== */

export type UserRole = "user" | "admin";

/** Profile document stored at users/{uid} in Firestore. */
export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  photoURL?: string;
  createdAt: number;
}

/* ==========================================================================
   ORDERS
   ========================================================================== */

export type OrderStatus = "pending" | "shipped" | "delivered" | "cancelled";

export interface OrderLine {
  id: number;
  title: string;
  price: number;
  image: string;
  quantity: number;
}

export interface Order {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  phone: string;
  address: string;
  items: OrderLine[];
  total: number;
  status: OrderStatus;
  createdAt: number;
}

/* ==========================================================================
   SHOP FILTERS (extended set used by the shop sidebar)
   ========================================================================== */

export interface PriceRange {
  min: number | null;
  max: number | null;
}
