import type { Product } from "./types";
import { addToCart } from "./state";
import { formatPrice, getProductCategorySlugs, getCategoryLabel } from "./utils";
import { showToast } from "./cart";

let rootEl: HTMLElement;
let qty = 1;

function ensureRoot(): HTMLElement {
  if (!rootEl) {
    rootEl = document.getElementById("modal-root")!;
  }
  return rootEl;
}

export function openProductQuickView(product: Product): void {
  const root = ensureRoot();
  qty = 1;

  const catSlug = getProductCategorySlugs(product)[0];
  const catLabel = catSlug ? getCategoryLabel(catSlug) : "";
  const desc = product.description ?? [];

  root.innerHTML = `
    <div class="modal-overlay" id="quickViewOverlay">
      <div class="modal-box">
        <button class="modal-close" id="modalCloseBtn" aria-label="Close">✕</button>
        <div class="modal-image">
          <img src="${product.image}" alt="${escapeHtml(product.title)}" />
        </div>
        <div class="modal-details">
          <span class="product-cat">${catLabel}</span>
          <h2>${escapeHtml(product.title)}</h2>
          <div class="modal-price">${formatPrice(product.price)}</div>
          <div class="modal-stock ${product.inStock ? "in" : "out"}">
            ${product.inStock ? "● In Stock" : "● Currently Sold Out"}
          </div>
          ${
            desc.length
              ? `<ul class="modal-desc">${desc.map((d) => `<li>${escapeHtml(d)}</li>`).join("")}</ul>`
              : ""
          }
          <div class="qty-row">
            <div class="qty-stepper">
              <button id="qtyMinus" aria-label="Decrease quantity">−</button>
              <span id="qtyValue">1</span>
              <button id="qtyPlus" aria-label="Increase quantity">+</button>
            </div>
          </div>
          <button class="btn btn-primary btn-block" id="modalAddToCart" ${
            product.inStock ? "" : "disabled"
          }>
            ${product.inStock ? "Add to Cart" : "Sold Out"}
          </button>
        </div>
      </div>
    </div>
  `;

  const overlay = document.getElementById("quickViewOverlay")!;
  requestAnimationFrame(() => overlay.classList.add("open"));

  document.getElementById("modalCloseBtn")!.addEventListener("click", closeQuickView);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeQuickView();
  });

  const qtyValueEl = document.getElementById("qtyValue")!;
  document.getElementById("qtyMinus")!.addEventListener("click", () => {
    qty = Math.max(1, qty - 1);
    qtyValueEl.textContent = String(qty);
  });
  document.getElementById("qtyPlus")!.addEventListener("click", () => {
    qty += 1;
    qtyValueEl.textContent = String(qty);
  });

  const addBtn = document.getElementById("modalAddToCart");
  addBtn?.addEventListener("click", () => {
    addToCart(product, qty);
    showToast(`${product.title} added to cart`);
    closeQuickView();
  });

  document.addEventListener("keydown", onEscape);
}

function onEscape(e: KeyboardEvent): void {
  if (e.key === "Escape") closeQuickView();
}

function closeQuickView(): void {
  const overlay = document.getElementById("quickViewOverlay");
  if (!overlay) return;
  overlay.classList.remove("open");
  document.removeEventListener("keydown", onEscape);
  setTimeout(() => {
    if (rootEl) rootEl.innerHTML = "";
  }, 250);
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
