import { getAllProducts } from "./productsService";
import type { Product } from "./types";
import { goToShop } from "./state";
import { debounce, formatPrice } from "./utils";
import { openProductQuickView } from "./modal";

let panelEl: HTMLElement;

export function setupSearch(): void {
  panelEl = document.getElementById("search-panel")!;
}

export function openSearch(): void {
  panelEl.innerHTML = `
    <div class="search-panel" id="searchOverlay">
      <div class="search-box">
        <form id="searchForm">
          <input type="text" id="searchInput" placeholder="Search for tote bags, journals, keychains…" autocomplete="off" />
          <button type="button" class="search-close" id="searchCloseBtn" aria-label="Close search">✕</button>
        </form>
        <div class="search-suggestions" id="searchSuggestions"></div>
      </div>
    </div>
  `;

  const overlay = document.getElementById("searchOverlay")!;
  const input = document.getElementById("searchInput") as HTMLInputElement;

  requestAnimationFrame(() => {
    overlay.classList.add("open");
    input.focus();
  });

  const runSearch = debounce((term: string) => {
    renderSuggestions(term.trim());
  }, 180);

  input.addEventListener("input", () => runSearch(input.value));

  document.getElementById("searchForm")!.addEventListener("submit", (e) => {
    e.preventDefault();
    const term = input.value.trim();
    if (term) {
      closeSearch();
      goToShop({ search: term });
    }
  });

  document.getElementById("searchCloseBtn")!.addEventListener("click", closeSearch);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeSearch();
  });
  document.addEventListener("keydown", onEscape);
}

function onEscape(e: KeyboardEvent): void {
  if (e.key === "Escape") closeSearch();
}

export function closeSearch(): void {
  const overlay = document.getElementById("searchOverlay");
  if (!overlay) return;
  overlay.classList.remove("open");
  document.removeEventListener("keydown", onEscape);
  setTimeout(() => {
    panelEl.innerHTML = "";
  }, 250);
}

function matchesTerm(product: Product, term: string): boolean {
  const t = term.toLowerCase();
  if (product.title.toLowerCase().includes(t)) return true;
  const subs = Array.isArray(product.subCategory)
    ? product.subCategory
    : [product.subCategory];
  return subs.some((s) => s.toLowerCase().includes(t));
}

function renderSuggestions(term: string): void {
  const box = document.getElementById("searchSuggestions");
  if (!box) return;

  if (!term) {
    box.innerHTML = "";
    return;
  }

  const results = getAllProducts().filter((p) => matchesTerm(p, term)).slice(0, 8);

  if (!results.length) {
    box.innerHTML = `<div class="search-empty">No products found for “${escapeHtml(term)}”.</div>`;
    return;
  }

  box.innerHTML = results
    .map(
      (p) => `
      <div class="search-suggestion" data-id="${p.id}">
        <img src="${p.image}" alt="${escapeHtml(p.title)}" />
        <div>
          <div class="s-title">${escapeHtml(p.title)}</div>
          <div class="s-price">${formatPrice(p.price)}</div>
        </div>
      </div>`
    )
    .join("");

  box.querySelectorAll<HTMLElement>(".search-suggestion").forEach((el) => {
    el.addEventListener("click", () => {
      const id = Number(el.dataset.id);
      const product = getAllProducts().find((p) => p.id === id);
      if (product) {
        closeSearch();
        openProductQuickView(product);
      }
    });
  });
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
