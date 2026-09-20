import type { Product } from "./types";
import { getAllProducts } from "./productsService";
import {
  CATEGORIES,
  formatPrice,
  getCategoryLabel,
  getCategoryThumbnail,
  getProductCategorySlugs,
  getProductSubCategories,
  getSubCategoriesForCategory,
} from "./utils";
import { addToCart, goToShop, resetFilters, setFilters, shopFilters } from "./state";
import { openProductQuickView } from "./modal";
import { showToast } from "./cart";
import { isFavourite, toggleFavourite } from "./favourites";
import { renderPagination } from "./pagination";

const SHOP_PAGE_SIZE = 12;
const HOME_PAGE_SIZE = 16;

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
        <button class="fav-btn${isFavourite(product.id) ? " saved" : ""}"
                data-action="fav"
                aria-pressed="${isFavourite(product.id)}"
                aria-label="Save ${escapeHtml(product.title)} to wishlist">♥</button>
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

export function bindProductCardEvents(cards: Element[] | NodeListOf<Element>): void {
  Array.from(cards).forEach((card) => {
    const id = Number((card as HTMLElement).dataset.id);
    const product = getAllProducts().find((p) => p.id === id);
    if (!product) return;

    card.querySelectorAll<HTMLElement>('[data-action="quickview"]').forEach((el) => {
      el.addEventListener("click", () => openProductQuickView(product));
    });

    card.querySelectorAll<HTMLButtonElement>('[data-action="fav"]').forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const saved = toggleFavourite(product.id);
        el.classList.toggle("saved", saved);
        el.setAttribute("aria-pressed", String(saved));
        showToast(saved ? `${product.title} saved to wishlist` : `${product.title} removed from wishlist`);
      });
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
    const count = getAllProducts().filter((p) =>
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

  const slice = getAllProducts().slice(0, homeVisibleCount);
  grid.innerHTML = slice.map(createProductCard).join("");
  bindProductCardEvents(grid.querySelectorAll(".product-card"));
  observeReveal(grid.querySelectorAll(".product-card"));

  const allLoaded = homeVisibleCount >= getAllProducts().length;
  if (sentinel) sentinel.style.display = allLoaded ? "none" : "block";
  if (endMsg) endMsg.style.display = allLoaded ? "block" : "none";
}

function appendHomeProductBatch(): void {
  const grid = document.getElementById("homeProductGrid");
  const sentinel = document.getElementById("homeScrollSentinel");
  const endMsg = document.getElementById("homeEndMessage");
  if (!grid) return;

  const nextSlice = getAllProducts().slice(homeVisibleCount, homeVisibleCount + HOME_PAGE_SIZE);
  if (!nextSlice.length) return;

  const temp = document.createElement("div");
  temp.innerHTML = nextSlice.map(createProductCard).join("");
  const newCards = Array.from(temp.children);
  newCards.forEach((card) => grid.appendChild(card));

  bindProductCardEvents(newCards);
  observeReveal(newCards);

  homeVisibleCount += HOME_PAGE_SIZE;

  const allLoaded = homeVisibleCount >= getAllProducts().length;
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
  
    while (homeVisibleCount < getAllProducts().length) {
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
  const { category, subCategory, search, sort, minPrice, maxPrice, inStockOnly } = shopFilters;
  const term = search.trim().toLowerCase();

  let list = getAllProducts().filter((p) => {
    if (category && !getProductCategorySlugs(p).includes(category)) return false;
    if (subCategory && !getProductSubCategories(p).includes(subCategory)) return false;
    if (inStockOnly && !p.inStock) return false;
    if (minPrice !== null && p.price < minPrice) return false;
    if (maxPrice !== null && p.price > maxPrice) return false;
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
  container.innerHTML = `
    <section class="shop-hero">
      <div class="container">
        <h1 id="shopHeroTitle">All Products</h1>
        <p id="shopHeroSubtitle">Every cute thing, in one place.</p>
      </div>
    </section>
    <div class="container">
      <div class="shop-layout">
        <button class="btn btn-outline filters-toggle" id="filtersToggle" type="button">Filters</button>

        <aside class="shop-filters" id="shopFilters">
          <div class="filter-head">
            <h3>Filters</h3>
            <button class="filter-reset" id="clearFiltersBtn" type="button">Clear all</button>
          </div>

          <div class="filter-group">
            <h4>Category</h4>
            <div id="categoryFilters"></div>
          </div>

          <div class="filter-group" id="subCategoryGroup">
            <h4>Type</h4>
            <div id="subCategoryFilters"></div>
          </div>

          <div class="filter-group">
            <h4>Price</h4>
            <div class="price-inputs">
              <input type="number" id="minPriceInput" min="0" placeholder="Min" />
              <span>to</span>
              <input type="number" id="maxPriceInput" min="0" placeholder="Max" />
            </div>
            <button class="btn btn-outline btn-block filter-apply" id="applyPriceBtn" type="button">Apply price</button>
          </div>

          <div class="filter-group">
            <label class="filter-check">
              <input type="checkbox" id="inStockOnly" />
              <span>In stock only</span>
            </label>
          </div>
        </aside>

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
          <div class="pagination-wrap" id="shopPagination"></div>
        </div>
      </div>
    </div>
  `;

  updateShopHeroTitle();
  renderFilterSidebar();
  renderToolbarAndGrid();
  bindShopChrome();
}

/* --------------------------- FILTER SIDEBAR --------------------------- */

function renderFilterSidebar(): void {
  const catBox = document.getElementById("categoryFilters");
  const subBox = document.getElementById("subCategoryFilters");
  const subGroup = document.getElementById("subCategoryGroup");
  if (!catBox || !subBox || !subGroup) return;

  const all = getAllProducts();

  catBox.innerHTML = CATEGORIES.map((cat) => {
    const count = all.filter((p) => getProductCategorySlugs(p).includes(cat.slug)).length;
    const active = shopFilters.category === cat.slug;
    return `<button class="filter-pill${active ? " active" : ""}" data-filter-cat="${cat.slug}">
        ${cat.label} <span>${count}</span>
      </button>`;
  }).join("");

  catBox.querySelectorAll<HTMLButtonElement>("[data-filter-cat]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const slug = btn.dataset.filterCat ?? null;
      const next = shopFilters.category === slug ? null : slug;
      setFilters({ category: next, subCategory: null });
    });
  });

  if (!shopFilters.category) {
    subGroup.style.display = "none";
    subBox.innerHTML = "";
    return;
  }

  const subs = getSubCategoriesForCategory(shopFilters.category);
  subGroup.style.display = subs.length ? "block" : "none";
  subBox.innerHTML = subs
    .map((sub) => {
      const active = shopFilters.subCategory === sub;
      return `<button class="filter-pill${active ? " active" : ""}" data-filter-sub="${escapeHtml(sub)}">${escapeHtml(sub)}</button>`;
    })
    .join("");

  subBox.querySelectorAll<HTMLButtonElement>("[data-filter-sub]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sub = btn.dataset.filterSub ?? null;
      setFilters({ subCategory: shopFilters.subCategory === sub ? null : sub });
    });
  });
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
  const sortSelect = document.getElementById("sortSelect") as HTMLSelectElement | null;
  if (!grid || !resultsCount || !chipsBox) return;

  const results = getFilteredProducts();
  const totalPages = Math.max(1, Math.ceil(results.length / SHOP_PAGE_SIZE));
  const page = Math.min(Math.max(1, shopFilters.page), totalPages);
  if (page !== shopFilters.page) shopFilters.page = page;

  const start = (page - 1) * SHOP_PAGE_SIZE;
  const visible = results.slice(start, start + SHOP_PAGE_SIZE);

  resultsCount.innerHTML = results.length
    ? `<strong>${results.length}</strong> item${results.length === 1 ? "" : "s"} found · showing ${start + 1}–${start + visible.length}`
    : `<strong>0</strong> items found`;

  if (sortSelect) sortSelect.value = shopFilters.sort;
  syncFilterInputs();

  chipsBox.innerHTML = buildChips();
  chipsBox.querySelectorAll<HTMLButtonElement>("[data-clear]").forEach((btn) => {
    btn.addEventListener("click", () => clearChip(btn.dataset.clear ?? ""));
  });

  if (!results.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <h3>Nothing matches these filters</h3>
        <p>Widen the price range or pick another category.</p>
      </div>
    `;
  } else {
    grid.innerHTML = visible.map(createProductCard).join("");
    bindProductCardEvents(grid.querySelectorAll(".product-card"));
    observeReveal(grid.querySelectorAll(".product-card"));
  }

  const pager = document.getElementById("shopPagination");
  if (pager) {
    renderPagination(pager, {
      currentPage: page,
      totalPages,
      onChange: (next) => {
        setFilters({ page: next });
        document.querySelector(".shop-toolbar")?.scrollIntoView({ behavior: "smooth", block: "start" });
      },
    });
  }

}

function syncFilterInputs(): void {
  const min = document.getElementById("minPriceInput") as HTMLInputElement | null;
  const max = document.getElementById("maxPriceInput") as HTMLInputElement | null;
  const stock = document.getElementById("inStockOnly") as HTMLInputElement | null;
  if (min) min.value = shopFilters.minPrice === null ? "" : String(shopFilters.minPrice);
  if (max) max.value = shopFilters.maxPrice === null ? "" : String(shopFilters.maxPrice);
  if (stock) stock.checked = shopFilters.inStockOnly;
}

function buildChips(): string {
  const chips: string[] = [];

  if (shopFilters.search) {
    chips.push(
      `<span class="chip">“${escapeHtml(shopFilters.search)}” <button data-clear="search">✕</button></span>`
    );
  }
  if (shopFilters.category) {
    chips.push(
      `<span class="chip">${escapeHtml(getCategoryLabel(shopFilters.category))} <button data-clear="category">✕</button></span>`
    );
  }
  if (shopFilters.subCategory) {
    chips.push(
      `<span class="chip">${escapeHtml(shopFilters.subCategory)} <button data-clear="subCategory">✕</button></span>`
    );
  }
  if (shopFilters.minPrice !== null || shopFilters.maxPrice !== null) {
    const from = shopFilters.minPrice === null ? "0" : String(shopFilters.minPrice);
    const to = shopFilters.maxPrice === null ? "any" : String(shopFilters.maxPrice);
    chips.push(`<span class="chip">Rs. ${from} – ${to} <button data-clear="price">✕</button></span>`);
  }
  if (shopFilters.inStockOnly) {
    chips.push(`<span class="chip">In stock only <button data-clear="stock">✕</button></span>`);
  }

  return chips.join("");
}

function clearChip(kind: string): void {
  switch (kind) {
    case "search":
      setFilters({ search: "" });
      break;
    case "category":
      setFilters({ category: null, subCategory: null });
      break;
    case "subCategory":
      setFilters({ subCategory: null });
      break;
    case "price":
      setFilters({ minPrice: null, maxPrice: null });
      break;
    case "stock":
      setFilters({ inStockOnly: false });
      break;
  }
}

function bindShopChrome(): void {
  document.getElementById("sortSelect")?.addEventListener("change", (e) => {
    const val = (e.target as HTMLSelectElement).value as typeof shopFilters.sort;
    setFilters({ sort: val });
  });

  document.getElementById("applyPriceBtn")?.addEventListener("click", applyPriceFilter);

  document.getElementById("inStockOnly")?.addEventListener("change", (e) => {
    setFilters({ inStockOnly: (e.target as HTMLInputElement).checked });
  });

  document.getElementById("clearFiltersBtn")?.addEventListener("click", () => resetFilters());

  document.getElementById("filtersToggle")?.addEventListener("click", () => {
    document.getElementById("shopFilters")?.classList.toggle("open");
  });

  ["minPriceInput", "maxPriceInput"].forEach((id) => {
    document.getElementById(id)?.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Enter") applyPriceFilter();
    });
  });
}

function applyPriceFilter(): void {
  const minEl = document.getElementById("minPriceInput") as HTMLInputElement | null;
  const maxEl = document.getElementById("maxPriceInput") as HTMLInputElement | null;

  const min = minEl && minEl.value.trim() !== "" ? Number(minEl.value) : null;
  const max = maxEl && maxEl.value.trim() !== "" ? Number(maxEl.value) : null;

  setFilters({
    minPrice: min !== null && !Number.isNaN(min) ? min : null,
    maxPrice: max !== null && !Number.isNaN(max) ? max : null,
  });
}

export function refreshShopPageIfMounted(): void {
  if (!document.getElementById("shopGrid")) return;
  updateShopHeroTitle();
  renderFilterSidebar();
  renderToolbarAndGrid();
}
