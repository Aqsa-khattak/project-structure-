import { CATEGORIES, getSubCategoriesForCategory } from "./utils";
import { bus, currentView, getCartCount, goHome, goToShop } from "./state";
import { openSearch } from "./search";
import { openCart } from "./cart";

const ICONS = {
  search:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  cart:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>',
};

let headerEl: HTMLElement;
const MOBILE_BREAKPOINT = 760;

function isMobileViewport(): boolean {
  return window.innerWidth <= MOBILE_BREAKPOINT;
}

function buildCategoryNavItem(slug: string, label: string): string {
  const subs = getSubCategoriesForCategory(slug);

  const subLinks = subs
    .map((s) => `<a href="#shop" data-cat="${slug}" data-sub="${s}">${s}</a>`)
    .join("");

  return `
    <div class="nav-item" data-cat-item="${slug}">
      <div class="nav-item-row">
        <a href="#shop" class="nav-cat-link" data-cat="${slug}">${label}</a>
        ${
          subs.length
            ? `<button class="nav-caret" type="button" aria-label="Show ${label} subcategories">▾</button>`
            : ""
        }
      </div>
      ${
        subs.length
          ? `<div class="dropdown-menu">
               <a href="#shop" data-cat="${slug}">All ${label}</a>
               ${subLinks}
             </div>`
          : ""
      }
    </div>
  `;
}

export function renderNavbar(): void {
  headerEl = document.getElementById("site-header")!;

  const catItems = CATEGORIES.map((c) => buildCategoryNavItem(c.slug, c.label)).join("");

  headerEl.innerHTML = `
    <div class="announce-bar">✨ Free shipping on orders over ₹999 &nbsp;|&nbsp; Handpicked cute stationery, bags &amp; jewellery</div>
    <div class="navbar container">
      <button class="nav-toggle" id="navToggle" aria-label="Toggle menu">
        <span></span><span></span><span></span>
      </button>

      <a href="#home" class="brand" id="brandLink">Paper<span class="brand-dot">nest</span></a>

      <nav class="nav-links" id="navLinks">
        <a href="#home" data-view="home">Home</a>
        ${catItems}
      </nav>

      <div class="nav-actions">
        <button class="icon-btn" id="searchBtn" aria-label="Search">${ICONS.search}</button>
        <button class="icon-btn" id="cartBtn" aria-label="Cart">
          ${ICONS.cart}
          <span class="cart-count" id="cartCount">0</span>
        </button>
      </div>
    </div>
  `;

  bindEvents();
  bus.on("cart:change", updateCartCount);
  bus.on("view:change", updateActiveLink);
  updateCartCount();
  updateActiveLink();
}

function bindEvents(): void {
  document.getElementById("brandLink")!.addEventListener("click", (e) => {
    e.preventDefault();
    closeMobileMenu();
    goHome();
  });

  // Home link + all category / subcategory links.
  headerEl.querySelectorAll<HTMLAnchorElement>(".nav-links > a, .nav-cat-link, .dropdown-menu a").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const view = a.dataset.view;
      const cat = a.dataset.cat;
      const sub = a.dataset.sub;

      if (view === "home") {
        closeMobileMenu();
        goHome();
        return;
      }

      if (cat) {
        closeMobileMenu();
        goToShop({ category: cat, subCategory: sub || null });
      }
    });
  });

  // Mobile accordion: tapping the caret expands/collapses that category's subcategory list.
  headerEl.querySelectorAll<HTMLButtonElement>(".nav-caret").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!isMobileViewport()) return;
      const item = btn.closest(".nav-item");
      if (!item) return;
      const wasOpen = item.classList.contains("open");
      headerEl.querySelectorAll(".nav-item.open").forEach((el) => el.classList.remove("open"));
      if (!wasOpen) item.classList.add("open");
    });
  });

  document.getElementById("navToggle")!.addEventListener("click", () => {
    document.getElementById("navLinks")!.classList.toggle("open");
  });

  document.getElementById("searchBtn")!.addEventListener("click", () => {
    closeMobileMenu();
    openSearch();
  });

  document.getElementById("cartBtn")!.addEventListener("click", () => {
    closeMobileMenu();
    openCart();
  });
}

function closeMobileMenu(): void {
  document.getElementById("navLinks")?.classList.remove("open");
  headerEl?.querySelectorAll(".nav-item.open").forEach((el) => el.classList.remove("open"));
}

function updateCartCount(): void {
  const el = document.getElementById("cartCount");
  if (!el) return;
  const count = getCartCount();
  el.textContent = String(count);
  el.style.display = count > 0 ? "flex" : "none";
}

function updateActiveLink(): void {
  headerEl.querySelectorAll<HTMLAnchorElement>(".nav-links > a").forEach((a) => {
    const view = a.dataset.view;
    a.classList.toggle("active", view === currentView);
  });
}
