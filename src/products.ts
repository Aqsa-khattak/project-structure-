import type { Product } from "./types";
import { productsData } from "./productsData";
import {
  CATEGORIES,
  formatPrice,
  getCategoryLabel,
  getCategoryThumbnail,
  getProductCategorySlugs,
  getProductSubCategories,
} from "./utils";
import { addToCart, goToShop, setFilters, shopFilters } from "./state";
import { openProductQuickView } from "./modal";
import { showToast } from "./cart";

const SHOP_PAGE_SIZE = 12;
const HOME_PAGE_SIZE = 16;

let shopVisibleCount = SHOP_PAGE_SIZE;
let homeVisibleCount = HOME_PAGE_SIZE;
let homeObserver: IntersectionObserver | null = null;

/* ==========================================================================
   HELPERS
   ========================================================================== */

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/** Fade/slide product & category cards into view as they scroll into the viewport. */
function observeReveal(elements: Element[] | NodeListOf<Element>): void {
  const items = Array.from(elements);
  if (!items.length) return;

  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -30px 0px" }
  );

  items.forEach((el) => observer.observe(el));
}

/* ==========================================================================
   PRODUCT CARD
   ========================================================================== */

export function createProductCard(product: Product): string {
  const catSlug = getProductCategorySlugs(product)[0];
  const catLabel = catSlug ? getCategoryLabel(catSlug) : "";

  return `
    <article class="product-card reveal" data-id="${product.id}">
      <div class="product-media" data-action="quickview">
        ${!product.inStock ? '<span class="badge badge-stock">Sold Out</span>' : ""}
        <img src="${product.image}" alt="${escapeHtml(product.title)}" loading="lazy" />
      </div>
      <div class="product-info">
        <span class="product-cat">${catLabel}</span>
        <h3 class="product-title">${escapeHtml(product.title)}</h3>
        <div class="product-bottom">
          <span class="product-price">${formatPrice(product.price)}</span>
          <button class="add-btn" data-action="add" ${product.inStock ? "" : "disabled"}>
            ${product.inStock ? "Add to Cart" : "Sold Out"}
          </button>
        </div>
      </div>
    </article>
  `;
}

/** Attach click handlers for quick-view & add-to-cart on the given `.product-card` elements. */
function bindProductCardEvents(cards: Element[] | NodeListOf<Element>): void {
  Array.from(cards).forEach((card) => {
    const id = Number((card as HTMLElement).dataset.id);
    const product = productsData.find((p) => p.id === id);
    if (!product) return;

    card.querySelectorAll<HTMLElement>('[data-action="quickview"]').forEach((el) => {
      el.addEventListener("click", () => openProductQuickView(product));
    });

    card.querySelectorAll<HTMLButtonElement>('[data-action="add"]').forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!product.inStock) return;
        addToCart(product, 1);
        showToast(`${product.title} added to cart`);
      });
    });
  });
}

/* ==========================================================================
   HOME PAGE — CATEGORY CARDS + FULL SCROLLING PRODUCT FEED
   ========================================================================== */

export function renderHomeSections(container: HTMLElement): void {
  homeVisibleCount = HOME_PAGE_SIZE;
  if (homeObserver) {
    homeObserver.disconnect();
    homeObserver = null;
  }

  const categoryCardsHtml = CATEGORIES.map((cat) => {
    const thumb = getCategoryThumbnail(cat.slug);
    const count = productsData.filter((p) =>
      getProductCategorySlugs(p).includes(cat.slug)
    ).length;
    return `
      <a class="category-card reveal" href="#shop" data-cat="${cat.slug}">
        <img src="${thumb}" alt="${cat.label}" loading="lazy" />
        <div class="cat-label">
          <strong>${cat.label}</strong>
          <span>${count} items</span>
        </div>
      </a>
    `;
  }).join("");

  container.insertAdjacentHTML("beforeend", `
    <section class="section">
      <div class="container">
        <div class="section-head">
          <span class="section-eyebrow">Shop by Category</span>
          <h2>Find Your Next Favourite</h2>
          <p>From tote bags to dainty jewellery — browse our best-loved corners of the shop.</p>
        </div>
        <div class="category-grid">${categoryCardsHtml}</div>
      </div>
    </section>

    <section class="section" style="padding-top:0;">
      <div class="container">
        <div class="section-head">
          <span class="section-eyebrow">All Products</span>
          <h2>Everything, In One Cosy Scroll</h2>
          <p>Keep scrolling — every product in the shop, right here.</p>
        </div>
        <div class="product-grid" id="homeProductGrid"></div>
        <div id="homeScrollSentinel" style="height:1px;"></div>
        <p id="homeEndMessage" class="empty-state" style="display:none;padding:30px 0 0;">✨ You've seen it all — that's the whole shop!</p>
      </div>
    </section>

    <section class="section" style="padding-top:0;">
      <div class="container">
        <div class="newsletter">
          <h2>Join the Papernest Club 🎀</h2>
          <p>Get 10% off your first order plus early access to new drops.</p>
          <form class="newsletter-form" id="newsletterForm">
            <input type="email" placeholder="you@example.com" required />
            <button class="btn btn-primary" type="submit">Subscribe</button>
          </form>
        </div>
      </div>
    </section>
  `);

  container.querySelectorAll<HTMLElement>(".category-card").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      goToShop({ category: el.dataset.cat ?? null });
    });
  });

  document.getElementById("newsletterForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    showToast("Thanks for subscribing! 💌");
    (e.target as HTMLFormElement).reset();
  });

  observeReveal(container.querySelectorAll(".category-card"));

  renderHomeProductBatch();
  setupHomeInfiniteScroll();
}

function renderHomeProductBatch(): void {
  const grid = document.getElementById("homeProductGrid");
  const sentinel = document.getElementById("homeScrollSentinel");
  const endMsg = document.getElementById("homeEndMessage");
  if (!grid) return;

  const slice = productsData.slice(0, homeVisibleCount);
  grid.innerHTML = slice.map(createProductCard).join("");
  bindProductCardEvents(grid.querySelectorAll(".product-card"));
  observeReveal(grid.querySelectorAll(".product-card"));

  const allLoaded = homeVisibleCount >= productsData.length;
  if (sentinel) sentinel.style.display = allLoaded ? "none" : "block";
  if (endMsg) endMsg.style.display = allLoaded ? "block" : "none";
}

function appendHomeProductBatch(): void {
  const grid = document.getElementById("homeProductGrid");
  const sentinel = document.getElementById("homeScrollSentinel");
  const endMsg = document.getElementById("homeEndMessage");
  if (!grid) return;

  const nextSlice = productsData.slice(homeVisibleCount, homeVisibleCount + HOME_PAGE_SIZE);
  if (!nextSlice.length) return;

  const temp = document.createElement("div");
  temp.innerHTML = nextSlice.map(createProductCard).join("");
  const newCards = Array.from(temp.children);
  newCards.forEach((card) => grid.appendChild(card));

  bindProductCardEvents(newCards);
  observeReveal(newCards);

  homeVisibleCount += HOME_PAGE_SIZE;

  const allLoaded = homeVisibleCount >= productsData.length;
  if (allLoaded) {
    if (sentinel) sentinel.style.display = "none";
    if (endMsg) endMsg.style.display = "block";
    if (homeObserver) {
      homeObserver.disconnect();
      homeObserver = null;
    }
  }
}

function setupHomeInfiniteScroll(): void {
  const sentinel = document.getElementById("homeScrollSentinel");
  if (!sentinel) return;

  if (!("IntersectionObserver" in window)) {
    // Fallback: load everything at once if the browser can't observe scroll.
    while (homeVisibleCount < productsData.length) {
      homeVisibleCount += HOME_PAGE_SIZE;
    }
    renderHomeProductBatch();
    return;
  }

  homeObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          appendHomeProductBatch();
        }
      });
    },
    { rootMargin: "300px 0px" }
  );
  homeObserver.observe(sentinel);
}

/** Stop the home page's infinite-scroll observer — call when navigating away. */
export function teardownHomeSections(): void {
  if (homeObserver) {
    homeObserver.disconnect();
    homeObserver = null;
  }
}

/* ==========================================================================
   CATEGORY RESULTS PAGE (reached via navbar category dropdowns / category cards)
   ========================================================================== */

function getFilteredProducts(): Product[] {
  const { category, subCategory, search, sort } = shopFilters;
  const term = search.trim().toLowerCase();

  let list = productsData.filter((p) => {
    if (category && !getProductCategorySlugs(p).includes(category)) return false;
    if (subCategory && !getProductSubCategories(p).includes(subCategory)) return false;
    if (term) {
      const inTitle = p.title.toLowerCase().includes(term);
      const inSub = getProductSubCategories(p).some((s) =>
        s.toLowerCase().includes(term)
      );
      if (!inTitle && !inSub) return false;
    }
    return true;
  });

  switch (sort) {
    case "price-asc":
      list = [...list].sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      list = [...list].sort((a, b) => b.price - a.price);
      break;
    case "name-asc":
      list = [...list].sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "name-desc":
      list = [...list].sort((a, b) => b.title.localeCompare(a.title));
      break;
    default:
      break;
  }

  return list;
}

export function renderShopPage(container: HTMLElement): void {
  shopVisibleCount = SHOP_PAGE_SIZE;
  container.innerHTML = `
    <section class="shop-hero">
      <div class="container">
        <h1 id="shopHeroTitle">All Products</h1>
        <p id="shopHeroSubtitle">Every cute thing, in one place.</p>
      </div>
    </section>
    <div class="container">
      <div class="shop-main">
        <div class="shop-toolbar">
          <div class="results-count" id="resultsCount"></div>
          <div class="toolbar-right">
            <select class="sort-select" id="sortSelect">
              <option value="featured">Sort: Featured</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="name-asc">Name: A to Z</option>
              <option value="name-desc">Name: Z to A</option>
            </select>
          </div>
        </div>
        <div class="active-chips" id="activeChips"></div>
        <div class="product-grid" id="shopGrid"></div>
        <div style="text-align:center;margin-top:34px;">
          <button class="btn btn-outline" id="loadMoreBtn">Load More</button>
        </div>
      </div>
    </div>
  `;

  updateShopHeroTitle();
  renderToolbarAndGrid();
  bindShopChrome();
}

function updateShopHeroTitle(): void {
  const titleEl = document.getElementById("shopHeroTitle");
  const subEl = document.getElementById("shopHeroSubtitle");
  if (!titleEl || !subEl) return;

  if (shopFilters.category) {
    const label = getCategoryLabel(shopFilters.category);
    titleEl.textContent = shopFilters.subCategory ? shopFilters.subCategory : label;
    subEl.textContent = shopFilters.subCategory
      ? `Part of our ${label} collection.`
      : `Explore our ${label.toLowerCase()} collection.`;
  } else {
    titleEl.textContent = "All Products";
    subEl.textContent = "Every cute thing, in one place.";
  }
}

function renderToolbarAndGrid(): void {
  const grid = document.getElementById("shopGrid");
  const resultsCount = document.getElementById("resultsCount");
  const chipsBox = document.getElementById("activeChips");
  const loadMoreBtn = document.getElementById("loadMoreBtn") as HTMLButtonElement | null;
  const sortSelect = document.getElementById("sortSelect") as HTMLSelectElement | null;
  if (!grid || !resultsCount || !chipsBox) return;

  const results = getFilteredProducts();
  const visible = results.slice(0, shopVisibleCount);

  resultsCount.innerHTML = `<strong>${results.length}</strong> item${results.length === 1 ? "" : "s"} found`;

  if (sortSelect) sortSelect.value = shopFilters.sort;

  const chips: string[] = [];
  if (shopFilters.search) {
    chips.push(
      `<span class="chip">“${escapeHtml(shopFilters.search)}” <button data-clear="search">✕</button></span>`
    );
  }
  chipsBox.innerHTML = chips.join("");
  chipsBox.querySelectorAll<HTMLButtonElement>("[data-clear]").forEach((btn) => {
    btn.addEventListener("click", () => setFilters({ search: "" }));
  });

  if (!results.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <h3>No products match your filters</h3>
        <p>Try a different category or search term.</p>
      </div>
    `;
  } else {
    grid.innerHTML = visible.map(createProductCard).join("");
    bindProductCardEvents(grid.querySelectorAll(".product-card"));
    observeReveal(grid.querySelectorAll(".product-card"));
  }

  if (loadMoreBtn) {
    loadMoreBtn.style.display = shopVisibleCount < results.length ? "inline-flex" : "none";
    loadMoreBtn.onclick = () => {
      shopVisibleCount += SHOP_PAGE_SIZE;
      renderToolbarAndGrid();
    };
  }
}

function bindShopChrome(): void {
  document.getElementById("sortSelect")?.addEventListener("change", (e) => {
    const val = (e.target as HTMLSelectElement).value as typeof shopFilters.sort;
    setFilters({ sort: val });
  });
}

/** Re-render title/grid when filters change while the category results page is mounted. */
export function refreshShopPageIfMounted(): void {
  if (!document.getElementById("shopGrid")) return;
  shopVisibleCount = SHOP_PAGE_SIZE;
  updateShopHeroTitle();
  renderToolbarAndGrid();
}
