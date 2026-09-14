import {
  bus,
  cart,
  getCartTotal,
  goToShop,
  removeFromCart,
  updateQuantity,
} from "./state";
import { formatPrice } from "./utils";

let rootEl: HTMLElement;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

function ensureRoot(): HTMLElement {
  if (!rootEl) rootEl = document.getElementById("cart-root")!;
  return rootEl;
}

export function setupCart(): void {
  ensureRoot();
  bus.on("cart:change", renderIfOpen);
}

export function openCart(): void {
  const root = ensureRoot();
  root.innerHTML = buildMarkup();
  const overlay = document.getElementById("cartOverlay")!;
  requestAnimationFrame(() => overlay.classList.add("open"));
  bindEvents();
}

export function closeCart(): void {
  const overlay = document.getElementById("cartOverlay");
  if (!overlay) return;
  overlay.classList.remove("open");
  setTimeout(() => {
    if (rootEl) rootEl.innerHTML = "";
  }, 300);
}

function renderIfOpen(): void {
  if (document.getElementById("cartOverlay")) {
    rootEl.innerHTML = buildMarkup();
    const overlay = document.getElementById("cartOverlay")!;
    overlay.classList.add("open");
    bindEvents();
  }
}

function buildMarkup(): string {
  const total = getCartTotal();

  const itemsHtml = cart.length
    ? cart
        .map(
          (item) => `
        <div class="cart-item" data-id="${item.product.id}">
          <img src="${item.product.image}" alt="${escapeHtml(item.product.title)}" />
          <div class="cart-item-info">
            <div class="cart-item-title">${escapeHtml(item.product.title)}</div>
            <div class="cart-item-price">${formatPrice(item.product.price)}</div>
            <div class="cart-item-row">
              <div class="qty-stepper">
                <button class="cart-qty-minus" aria-label="Decrease quantity">−</button>
                <span>${item.quantity}</span>
                <button class="cart-qty-plus" aria-label="Increase quantity">+</button>
              </div>
              <button class="cart-remove">Remove</button>
            </div>
          </div>
        </div>`
        )
        .join("")
    : `<div class="cart-empty">
         <p>🛍️ Your cart is feeling a little empty.</p>
       </div>`;

  return `
    <div class="cart-overlay" id="cartOverlay">
      <aside class="cart-drawer">
        <div class="cart-header">
          <h3>Your Bag (${cart.reduce((n, i) => n + i.quantity, 0)})</h3>
          <button class="modal-close" id="cartCloseBtn" aria-label="Close cart">✕</button>
        </div>
        <div class="cart-items">${itemsHtml}</div>
        <div class="cart-footer">
          <div class="cart-subtotal"><span>Subtotal</span><span>${formatPrice(total)}</span></div>
          <button class="btn btn-primary btn-block" id="checkoutBtn" ${
            cart.length ? "" : "disabled"
          }>Checkout</button>
          <button class="btn btn-outline btn-block" id="continueShoppingBtn" style="margin-top:10px;">Continue Shopping</button>
        </div>
      </aside>
    </div>
  `;
}

function bindEvents(): void {
  const overlay = document.getElementById("cartOverlay")!;

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeCart();
  });

  document.getElementById("cartCloseBtn")!.addEventListener("click", closeCart);

  document.getElementById("continueShoppingBtn")!.addEventListener("click", () => {
    closeCart();
    goToShop();
  });

  document.getElementById("checkoutBtn")!.addEventListener("click", () => {
    showToast("Checkout coming soon — thanks for shopping with Papernest!");
  });

  document.querySelectorAll<HTMLElement>(".cart-item").forEach((row) => {
    const id = Number(row.dataset.id);
    const item = cart.find((i) => i.product.id === id);
    if (!item) return;

    row.querySelector(".cart-qty-minus")!.addEventListener("click", () => {
      updateQuantity(id, item.quantity - 1);
    });
    row.querySelector(".cart-qty-plus")!.addEventListener("click", () => {
      updateQuantity(id, item.quantity + 1);
    });
    row.querySelector(".cart-remove")!.addEventListener("click", () => {
      removeFromCart(id);
    });
  });
}

export function showToast(message: string): void {
  const root = document.getElementById("toast-root");
  if (!root) return;
  root.innerHTML = `<div class="toast" id="toastEl">${escapeHtml(message)}</div>`;
  const toastEl = document.getElementById("toastEl")!;
  requestAnimationFrame(() => toastEl.classList.add("show"));

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove("show");
    setTimeout(() => {
      if (root.innerHTML.includes("toastEl")) root.innerHTML = "";
    }, 250);
  }, 2400);
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
