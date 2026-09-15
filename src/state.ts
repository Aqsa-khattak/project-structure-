import type { CartItem, Product, ShopFilters, ViewName } from "./types";

type Listener = () => void;

class Store {
  private listeners: Record<string, Listener[]> = {};

  on(event: string, cb: Listener) {
    (this.listeners[event] ??= []).push(cb);
  }

  emit(event: string) {
    (this.listeners[event] ?? []).forEach((cb) => cb());
  }
}

export const bus = new Store();

/* -------------------------------- VIEW / ROUTER -------------------------------- */

export let currentView: ViewName = "home";

export function setView(view: ViewName) {
  if (currentView === view) return;
  currentView = view;
  bus.emit("view:change");
}

/* -------------------------------- SHOP FILTERS -------------------------------- */

export const shopFilters: ShopFilters = {
  category: null,
  subCategory: null,
  search: "",
  sort: "featured",
};

export function resetFilters() {
  shopFilters.category = null;
  shopFilters.subCategory = null;
  shopFilters.search = "";
  shopFilters.sort = "featured";
  bus.emit("filters:change");
}

export function setFilters(partial: Partial<ShopFilters>) {
  Object.assign(shopFilters, partial);
  bus.emit("filters:change");
}

/** Navigate to the Shop page, optionally pre-filtering by category / subcategory / search term. */
export function goToShop(opts: Partial<ShopFilters> = {}) {
  shopFilters.category = opts.category ?? null;
  shopFilters.subCategory = opts.subCategory ?? null;
  shopFilters.search = opts.search ?? "";
  shopFilters.sort = opts.sort ?? "featured";
  window.location.hash = "#shop";
  setView("shop");
  bus.emit("filters:change");
}

export function goHome() {
  window.location.hash = "#home";
  setView("home");
}

/* -------------------------------- CART -------------------------------- */

const CART_KEY = "papernest_cart";

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const cart: CartItem[] = loadCart();

function persistCart() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch {
    /* storage unavailable — ignore */
  }
  bus.emit("cart:change");
}

export function addToCart(product: Product, quantity = 1) {
  const existing = cart.find((item) => item.product.id === product.id);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ product, quantity });
  }
  persistCart();
}

export function removeFromCart(productId: number) {
  const idx = cart.findIndex((item) => item.product.id === productId);
  if (idx !== -1) cart.splice(idx, 1);
  persistCart();
}

export function updateQuantity(productId: number, quantity: number) {
  const item = cart.find((i) => i.product.id === productId);
  if (!item) return;
  if (quantity <= 0) {
    removeFromCart(productId);
    return;
  }
  item.quantity = quantity;
  persistCart();
}

export function clearCart() {
  cart.length = 0;
  persistCart();
}

export function getCartCount(): number {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

export function getCartTotal(): number {
  return cart.reduce((sum, item) => sum + item.quantity * item.product.price, 0);
}
