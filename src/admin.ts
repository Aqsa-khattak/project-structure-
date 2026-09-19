import { isAdmin, isLoggedIn, openAuthModal, getProfile } from "./auth";
import { signedOutMarkup } from "./dashboard";
import {
  deleteProduct,
  getAllProducts,
  importBundledCatalog,
  isUsingLocalCatalog,
  nextProductId,
  saveProduct,
} from "./productsService";
import { getAllOrders, updateOrderStatus, ORDER_STATUSES } from "./orders";
import { getAllUsers, setUserRole } from "./usersService";
import { CATEGORIES, formatPrice } from "./utils";
import { renderPagination } from "./pagination";
import { navigate } from "./state";
import { showToast } from "./cart";
import { isFirebaseConfigured } from "./firebase";
import type { Order, OrderStatus, Product, UserProfile } from "./types";

type Tab = "overview" | "products" | "orders" | "users";

const ROWS_PER_PAGE = 8;

let activeTab: Tab = "overview";
let productPage = 1;
let productQuery = "";
let orders: Order[] = [];
let users: UserProfile[] = [];
let ordersLoaded = false;
let usersLoaded = false;

/* ==========================================================================
   ENTRY — guarded by role
   ========================================================================== */

export function renderAdminPage(container: HTMLElement): void {
  if (!isLoggedIn()) {
    container.innerHTML = signedOutMarkup(
      "Admin area",
      "Sign in with an admin account to manage the shop."
    );
    document.getElementById("gateSignInBtn")?.addEventListener("click", () =>
      openAuthModal("login", () => navigate("admin"))
    );
    return;
  }

  if (!isAdmin()) {
    container.innerHTML = `
      <section class="shop-hero">
        <div class="container">
          <h1>Admins only</h1>
          <p>This account doesn't have admin access.</p>
        </div>
      </section>
      <div class="container">
        <div class="empty-state">
          <h3>Signed in as ${escapeHtml(getProfile()?.email ?? "")}</h3>
          <p>Ask an existing admin to upgrade your role, then reload.</p>
          <button class="btn btn-primary" id="backToShopBtn" type="button">Back to the shop</button>
        </div>
      </div>
    `;
    document.getElementById("backToShopBtn")?.addEventListener("click", () => navigate("home"));
    return;
  }

  container.innerHTML = `
    <section class="dash-hero admin-hero">
      <div class="container">
        <span class="dash-role">Admin</span>
        <h1>Shop control room</h1>
        <p>Products, orders and people — all in one place.</p>
      </div>
    </section>

    <div class="container">
      <nav class="admin-tabs" id="adminTabs">
        <button data-tab="overview">Overview</button>
        <button data-tab="products">Products</button>
        <button data-tab="orders">Orders</button>
        <button data-tab="users">Users</button>
      </nav>
      <div id="adminPanel"></div>
    </div>
  `;

  document.querySelectorAll<HTMLButtonElement>("#adminTabs button").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab as Tab;
      renderTab();
    });
  });

  renderTab();
}

function renderTab(): void {
  document.querySelectorAll<HTMLButtonElement>("#adminTabs button").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === activeTab);
  });

  const panel = document.getElementById("adminPanel");
  if (!panel) return;

  switch (activeTab) {
    case "products":
      renderProductsTab(panel);
      break;
    case "orders":
      renderOrdersTab(panel);
      break;
    case "users":
      renderUsersTab(panel);
      break;
    default:
      renderOverviewTab(panel);
  }
}

/* ==========================================================================
   OVERVIEW
   ========================================================================== */

function renderOverviewTab(panel: HTMLElement): void {
  const products = getAllProducts();
  const outOfStock = products.filter((p) => !p.inStock).length;

  panel.innerHTML = `
    <div class="stat-row">
      <div class="stat-card"><span>${products.length}</span><small>Products</small></div>
      <div class="stat-card"><span id="statOrderCount">—</span><small>Orders</small></div>
      <div class="stat-card"><span id="statRevenue">—</span><small>Revenue</small></div>
      <div class="stat-card"><span>${outOfStock}</span><small>Sold out</small></div>
    </div>

    ${
      isUsingLocalCatalog()
        ? `<section class="panel notice">
             <h2>Catalog isn't editable yet</h2>
             <p class="panel-note">The shop is reading the bundled product list. Import it into Firestore once and you'll be able to add, edit and remove products from here.</p>
             <button class="btn btn-primary" id="importCatalogBtn" type="button">Import catalog to Firestore</button>
           </section>`
        : ""
    }

    <section class="panel">
      <h2>Latest orders</h2>
      <div id="recentOrders"><p class="panel-note">Loading…</p></div>
    </section>
  `;

  document.getElementById("importCatalogBtn")?.addEventListener("click", onImportCatalog);

  void ensureOrders().then(() => {
    const count = document.getElementById("statOrderCount");
    const revenue = document.getElementById("statRevenue");
    const recent = document.getElementById("recentOrders");
    if (count) count.textContent = String(orders.length);
    if (revenue) {
      const paid = orders
        .filter((o) => o.status !== "cancelled")
        .reduce((sum, o) => sum + o.total, 0);
      revenue.textContent = formatPrice(paid);
    }
    if (recent) {
      recent.innerHTML = orders.length
        ? ordersTable(orders.slice(0, 5), false)
        : `<p class="panel-note">No orders have come in yet.</p>`;
    }
  });
}

async function onImportCatalog(): Promise<void> {
  const btn = document.getElementById("importCatalogBtn") as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Importing…";
  }
  try {
    const count = await importBundledCatalog();
    showToast(`Imported ${count} products`);
    renderTab();
  } catch (err) {
    console.error(err);
    showToast("Import failed — check your Firestore rules");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Import catalog to Firestore";
    }
  }
}

/* ==========================================================================
   PRODUCTS
   ========================================================================== */

function renderProductsTab(panel: HTMLElement): void {
  panel.innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <h2>Products</h2>
        <div class="panel-actions">
          <input type="search" id="adminProductSearch" placeholder="Search products…" value="${escapeHtml(productQuery)}" />
          <button class="btn btn-primary" id="addProductBtn" type="button" ${
            isUsingLocalCatalog() ? "disabled" : ""
          }>Add product</button>
        </div>
      </div>
      ${
        isUsingLocalCatalog()
          ? `<p class="panel-note">Import the catalog from the Overview tab to unlock editing.</p>`
          : ""
      }
      <div id="adminProductTable"></div>
      <div class="pagination-wrap" id="adminProductPagination"></div>
    </section>
  `;

  document.getElementById("addProductBtn")?.addEventListener("click", () => openProductForm(null));

  const search = document.getElementById("adminProductSearch") as HTMLInputElement | null;
  search?.addEventListener("input", () => {
    productQuery = search.value;
    productPage = 1;
    drawProductTable();
  });

  drawProductTable();
}

function drawProductTable(): void {
  const box = document.getElementById("adminProductTable");
  const pager = document.getElementById("adminProductPagination");
  if (!box) return;

  const term = productQuery.trim().toLowerCase();
  const list = getAllProducts().filter((p) => !term || p.title.toLowerCase().includes(term));

  const totalPages = Math.max(1, Math.ceil(list.length / ROWS_PER_PAGE));
  productPage = Math.min(productPage, totalPages);
  const start = (productPage - 1) * ROWS_PER_PAGE;
  const rows = list.slice(start, start + ROWS_PER_PAGE);

  box.innerHTML = list.length
    ? `<div class="table-scroll">
        <table class="admin-table">
          <thead>
            <tr><th>Product</th><th>Price</th><th>Category</th><th>Stock</th><th></th></tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (p) => `<tr>
                  <td class="cell-product">
                    <img src="${p.image}" alt="" loading="lazy" />
                    <span>${escapeHtml(p.title)}</span>
                  </td>
                  <td>${formatPrice(p.price)}</td>
                  <td>${escapeHtml(toList(p.category).join(", "))}</td>
                  <td><span class="status ${p.inStock ? "status-delivered" : "status-cancelled"}">${
                    p.inStock ? "In stock" : "Sold out"
                  }</span></td>
                  <td class="cell-actions">
                    <button class="row-btn" data-edit="${p.id}" ${isUsingLocalCatalog() ? "disabled" : ""}>Edit</button>
                    <button class="row-btn danger" data-delete="${p.id}" ${isUsingLocalCatalog() ? "disabled" : ""}>Delete</button>
                  </td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>`
    : `<p class="panel-note">No products match “${escapeHtml(productQuery)}”.</p>`;

  box.querySelectorAll<HTMLButtonElement>("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const product = getAllProducts().find((p) => p.id === Number(btn.dataset.edit));
      if (product) openProductForm(product);
    });
  });

  box.querySelectorAll<HTMLButtonElement>("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => void onDeleteProduct(Number(btn.dataset.delete)));
  });

  if (pager) {
    renderPagination(pager, {
      currentPage: productPage,
      totalPages,
      onChange: (page) => {
        productPage = page;
        drawProductTable();
      },
    });
  }
}

async function onDeleteProduct(id: number): Promise<void> {
  const product = getAllProducts().find((p) => p.id === id);
  if (!product) return;
  if (!window.confirm(`Delete “${product.title}”? This can't be undone.`)) return;

  try {
    await deleteProduct(id);
    showToast("Product deleted");
    drawProductTable();
  } catch (err) {
    console.error(err);
    showToast("Delete failed");
  }
}

/* --------------------------- PRODUCT FORM --------------------------- */

function openProductForm(product: Product | null): void {
  const root = document.getElementById("modal-root");
  if (!root) return;

  const editing = product !== null;
  const p = product;

  root.innerHTML = `
    <div class="modal-overlay" id="productFormOverlay">
      <div class="checkout-box wide">
        <button class="modal-close" id="productFormClose" aria-label="Close">✕</button>
        <h2>${editing ? "Edit product" : "Add a product"}</h2>

        <form class="auth-form" id="productForm" novalidate>
          <div class="auth-field">
            <label for="pfTitle">Title</label>
            <input type="text" id="pfTitle" value="${escapeHtml(p?.title ?? "")}" required />
          </div>

          <div class="form-row">
            <div class="auth-field">
              <label for="pfPrice">Price (Rs.)</label>
              <input type="number" id="pfPrice" min="0" value="${p?.price ?? ""}" required />
            </div>
            <div class="auth-field">
              <label for="pfSub">Type / subcategory</label>
              <input type="text" id="pfSub" value="${escapeHtml(toList(p?.subCategory ?? []).join(", "))}" placeholder="tote/shoulder bag" />
            </div>
          </div>

          <div class="auth-field">
            <label for="pfImage">Image path</label>
            <input type="text" id="pfImage" value="${escapeHtml(p?.image ?? "")}" placeholder="/assets/totebag/totebag1.jpg" />
          </div>

          <div class="auth-field">
            <label>Categories</label>
            <div class="checkbox-grid">
              ${CATEGORIES.map((cat) => {
                const raw = toList(p?.category ?? []).map((c) => c.toLowerCase());
                const checked = cat.match.some((m) => raw.includes(m));
                return `<label class="filter-check">
                  <input type="checkbox" class="pf-cat" value="${cat.match[0]}" ${checked ? "checked" : ""} />
                  <span>${cat.label}</span>
                </label>`;
              }).join("")}
            </div>
          </div>

          <div class="auth-field">
            <label for="pfDesc">Details (one per line)</label>
            <textarea id="pfDesc" rows="4">${escapeHtml((p?.description ?? []).join("\n"))}</textarea>
          </div>

          <label class="filter-check">
            <input type="checkbox" id="pfStock" ${p ? (p.inStock ? "checked" : "") : "checked"} />
            <span>In stock</span>
          </label>

          <p class="auth-error" id="productFormError"></p>
          <button type="submit" class="btn btn-primary btn-block" id="productFormSubmit">
            ${editing ? "Save changes" : "Add product"}
          </button>
        </form>
      </div>
    </div>
  `;

  const overlay = document.getElementById("productFormOverlay")!;
  requestAnimationFrame(() => overlay.classList.add("open"));
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeProductForm();
  });
  document.getElementById("productFormClose")!.addEventListener("click", closeProductForm);

  document.getElementById("productForm")!.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("productFormError")!;
    const btn = document.getElementById("productFormSubmit") as HTMLButtonElement;

    const title = (document.getElementById("pfTitle") as HTMLInputElement).value.trim();
    const price = Number((document.getElementById("pfPrice") as HTMLInputElement).value);
    const image = (document.getElementById("pfImage") as HTMLInputElement).value.trim();
    const sub = (document.getElementById("pfSub") as HTMLInputElement).value.trim();
    const desc = (document.getElementById("pfDesc") as HTMLTextAreaElement).value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const inStock = (document.getElementById("pfStock") as HTMLInputElement).checked;
    const cats = Array.from(document.querySelectorAll<HTMLInputElement>(".pf-cat:checked")).map(
      (c) => c.value
    );

    if (title.length < 3) {
      errorEl.textContent = "Give the product a title of at least 3 characters.";
      return;
    }
    if (!price || price <= 0) {
      errorEl.textContent = "Set a price above zero.";
      return;
    }
    if (!cats.length) {
      errorEl.textContent = "Pick at least one category.";
      return;
    }

    const payload: Product = {
      id: p?.id ?? nextProductId(),
      title,
      price,
      image: image || "/assets/placeholder.jpg",
      category: cats,
      subCategory: sub ? sub.split(",").map((s) => s.trim()).filter(Boolean) : [],
      inStock,
      ...(desc.length ? { description: desc } : {}),
    };

    errorEl.textContent = "";
    btn.disabled = true;
    btn.textContent = "Saving…";

    try {
      await saveProduct(payload);
      closeProductForm();
      showToast(editing ? "Product updated" : "Product added");
      drawProductTable();
    } catch (err) {
      console.error(err);
      errorEl.textContent = "Save failed — check your Firestore rules.";
      btn.disabled = false;
      btn.textContent = editing ? "Save changes" : "Add product";
    }
  });
}

function closeProductForm(): void {
  const overlay = document.getElementById("productFormOverlay");
  if (!overlay) return;
  overlay.classList.remove("open");
  setTimeout(() => {
    const root = document.getElementById("modal-root");
    if (root) root.innerHTML = "";
  }, 250);
}

/* ==========================================================================
   ORDERS
   ========================================================================== */

function renderOrdersTab(panel: HTMLElement): void {
  panel.innerHTML = `
    <section class="panel">
      <h2>Orders</h2>
      <div id="adminOrders"><p class="panel-note">Loading orders…</p></div>
    </section>
  `;

  void ensureOrders(true).then(() => {
    const box = document.getElementById("adminOrders");
    if (!box) return;
    box.innerHTML = orders.length
      ? ordersTable(orders, true)
      : `<p class="panel-note">No orders yet.</p>`;

    box.querySelectorAll<HTMLSelectElement>("[data-order]").forEach((select) => {
      select.addEventListener("change", async () => {
        const id = select.dataset.order!;
        const status = select.value as OrderStatus;
        try {
          await updateOrderStatus(id, status);
          const found = orders.find((o) => o.id === id);
          if (found) found.status = status;
          showToast(`Order marked ${status}`);
          renderOrdersTab(panel);
        } catch (err) {
          console.error(err);
          showToast("Could not update that order");
        }
      });
    });
  });
}

function ordersTable(list: Order[], editable: boolean): string {
  return `
    <div class="table-scroll">
      <table class="admin-table">
        <thead>
          <tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${list
            .map(
              (o) => `<tr>
                <td>
                  <strong>#${o.id.slice(0, 6).toUpperCase()}</strong><br />
                  <span class="order-date">${new Date(o.createdAt).toLocaleDateString("en-GB")}</span>
                </td>
                <td>${escapeHtml(o.userName)}<br /><span class="order-date">${escapeHtml(o.userEmail)}</span></td>
                <td>${o.items.reduce((n, i) => n + i.quantity, 0)}</td>
                <td>${formatPrice(o.total)}</td>
                <td>${
                  editable
                    ? `<select class="sort-select" data-order="${o.id}">
                         ${ORDER_STATUSES.map(
                           (s) => `<option value="${s}" ${s === o.status ? "selected" : ""}>${s}</option>`
                         ).join("")}
                       </select>`
                    : `<span class="status status-${o.status}">${o.status}</span>`
                }</td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function ensureOrders(force = false): Promise<void> {
  if (!isFirebaseConfigured) {
    orders = [];
    ordersLoaded = true;
    return;
  }
  if (ordersLoaded && !force) return;
  try {
    orders = await getAllOrders();
  } catch (err) {
    console.error(err);
    orders = [];
  }
  ordersLoaded = true;
}

/* ==========================================================================
   USERS
   ========================================================================== */

function renderUsersTab(panel: HTMLElement): void {
  panel.innerHTML = `
    <section class="panel">
      <h2>Registered users</h2>
      <div id="adminUsers"><p class="panel-note">Loading users…</p></div>
    </section>
  `;

  void ensureUsers(true).then(() => {
    const box = document.getElementById("adminUsers");
    if (!box) return;

    box.innerHTML = users.length
      ? `<div class="table-scroll">
          <table class="admin-table">
            <thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Role</th></tr></thead>
            <tbody>
              ${users
                .map(
                  (u) => `<tr>
                    <td>${escapeHtml(u.name)}</td>
                    <td>${escapeHtml(u.email)}</td>
                    <td>${new Date(u.createdAt).toLocaleDateString("en-GB")}</td>
                    <td>
                      <select class="sort-select" data-user="${u.uid}">
                        <option value="user" ${u.role === "user" ? "selected" : ""}>user</option>
                        <option value="admin" ${u.role === "admin" ? "selected" : ""}>admin</option>
                      </select>
                    </td>
                  </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>`
      : `<p class="panel-note">No users found.</p>`;

    box.querySelectorAll<HTMLSelectElement>("[data-user]").forEach((select) => {
      select.addEventListener("change", async () => {
        const uid = select.dataset.user!;
        try {
          await setUserRole(uid, select.value as UserProfile["role"]);
          const found = users.find((u) => u.uid === uid);
          if (found) found.role = select.value as UserProfile["role"];
          showToast("Role updated");
        } catch (err) {
          console.error(err);
          showToast("Could not change that role");
        }
      });
    });
  });
}

async function ensureUsers(force = false): Promise<void> {
  if (!isFirebaseConfigured) {
    users = [];
    usersLoaded = true;
    return;
  }
  if (usersLoaded && !force) return;
  try {
    users = await getAllUsers();
  } catch (err) {
    console.error(err);
    users = [];
  }
  usersLoaded = true;
}

/* ==========================================================================
   HELPERS
   ========================================================================== */

function toList(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value];
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
