import { getCurrentUser, getProfile, isAdmin, logOut, openAuthModal, updateMyName } from "./auth";
import { getFavouriteProducts, clearFavourites } from "./favourites";
import { createProductCard, bindProductCardEvents } from "./products";
import { getMyOrders } from "./orders";
import { formatPrice } from "./utils";
import { assetUrl } from "./assetPath";
import { getCartCount, goToShop, navigate } from "./state";
import { showToast } from "./cart";
import type { Order } from "./types";
import { isFirebaseConfigured } from "./firebase";

/* ==========================================================================
   WISHLIST PAGE  (#wishlist)
   ========================================================================== */

export function renderWishlistPage(container: HTMLElement): void {
  const products = getFavouriteProducts();

  container.innerHTML = `
    <section class="shop-hero">
      <div class="container">
        <h1>Your wishlist</h1>
        <p>${products.length ? "The bits you're keeping an eye on." : "Tap the heart on any product to save it here."}</p>
      </div>
    </section>
    <div class="container">
      <div class="shop-main">
        ${
          products.length
            ? `<div class="shop-toolbar">
                 <div class="results-count"><strong>${products.length}</strong> saved item${products.length === 1 ? "" : "s"}</div>
                 <button class="btn btn-outline" id="clearFavsBtn" type="button">Clear wishlist</button>
               </div>
               <div class="product-grid" id="wishlistGrid"></div>`
            : `<div class="empty-state">
                 <h3>Nothing saved yet</h3>
                 <p>Browse the shop and heart anything you like the look of.</p>
                 <button class="btn btn-primary" id="wishlistShopBtn" type="button">Start browsing</button>
               </div>`
        }
      </div>
    </div>
  `;

  const grid = document.getElementById("wishlistGrid");
  if (grid) {
    grid.innerHTML = products.map(createProductCard).join("");
    bindProductCardEvents(grid.querySelectorAll(".product-card"));
    grid.querySelectorAll(".product-card").forEach((c) => c.classList.add("visible"));
  }

  document.getElementById("wishlistShopBtn")?.addEventListener("click", () => goToShop());
  document.getElementById("clearFavsBtn")?.addEventListener("click", () => {
    clearFavourites();
    showToast("Wishlist cleared");
    renderWishlistPage(container);
  });
}

/* ==========================================================================
   ACCOUNT DASHBOARD  (#account)
   ========================================================================== */

export function renderAccountPage(container: HTMLElement): void {
  const user = getCurrentUser();

  if (!user) {
    container.innerHTML = signedOutMarkup(
      "Your dashboard is behind the door",
      "Sign in to see your orders, saved items and profile."
    );
    document.getElementById("gateSignInBtn")?.addEventListener("click", () =>
      openAuthModal("login", () => navigate("account"))
    );
    return;
  }

  const admin = isAdmin();
  const profile = getProfile();

  const profilePanel = `
    <aside class="panel">
      <h2>Profile</h2>
      <div class="auth-field">
        <label for="profileName">Display name</label>
        <input type="text" id="profileName" value="${escapeHtml(profile?.name ?? "")}" />
      </div>
      <button class="btn btn-primary btn-block" id="saveProfileBtn" type="button">Save changes</button>

      <div class="panel-links">
        <button class="panel-link" id="goWishlistBtn" type="button">View wishlist</button>
        <button class="panel-link" id="goShopBtn" type="button">Continue shopping</button>
        ${admin ? `<button class="panel-link" id="goAdminBtn" type="button">Open admin dashboard</button>` : ""}
        <button class="panel-link danger" id="signOutBtn" type="button">Sign out</button>
      </div>
    </aside>
  `;

  container.innerHTML = `
    <section class="dash-hero">
      <div class="container">
        <span class="dash-role">${admin ? "Admin" : "Member"}</span>
        <h1>Hi ${escapeHtml(profile?.name ?? "there")}</h1>
        <p>${escapeHtml(profile?.email ?? "")}</p>
      </div>
    </section>

    <div class="container">
      ${
        admin
          ? `<div class="dash-grid dash-grid-solo">${profilePanel}</div>`
          : `<div class="stat-row">
               <div class="stat-card"><span id="statOrders">—</span><small>Orders placed</small></div>
               <div class="stat-card"><span>${getFavouriteProducts().length}</span><small>Saved items</small></div>
               <div class="stat-card"><span>${getCartCount()}</span><small>In your bag</small></div>
             </div>

             <div class="dash-grid">
               <section class="panel">
                 <h2>Your orders</h2>
                 <div id="ordersList"><p class="panel-note">Loading your orders…</p></div>
               </section>
               ${profilePanel}
             </div>`
      }
    </div>
  `;

  document.getElementById("saveProfileBtn")?.addEventListener("click", async () => {
    const name = (document.getElementById("profileName") as HTMLInputElement).value.trim();
    if (name.length < 2) {
      showToast("Names need at least 2 characters");
      return;
    }
    await updateMyName(name);
    showToast("Profile updated");
  });

  document.getElementById("goWishlistBtn")?.addEventListener("click", () => navigate("wishlist"));
  document.getElementById("goShopBtn")?.addEventListener("click", () => goToShop());
  document.getElementById("goAdminBtn")?.addEventListener("click", () => navigate("admin"));
  document.getElementById("signOutBtn")?.addEventListener("click", async () => {
    await logOut();
    navigate("home");
  });

  if (!admin) void loadOrders();
}

async function loadOrders(): Promise<void> {
  const box = document.getElementById("ordersList");
  const stat = document.getElementById("statOrders");
  if (!box) return;

  if (!isFirebaseConfigured) {
    box.innerHTML = `<p class="panel-note">Connect Firebase in src/firebase.ts to see live orders.</p>`;
    if (stat) stat.textContent = "0";
    return;
  }

  try {
    const orders = await getMyOrders();
    if (stat) stat.textContent = String(orders.length);

    box.innerHTML = orders.length
      ? orders.map(orderCard).join("")
      : `<p class="panel-note">No orders yet — your first one will show up here.</p>`;
  } catch (err) {
    console.error(err);
    box.innerHTML = `<p class="panel-note">We couldn't load your orders just now.</p>`;
  }
}

function orderCard(order: Order): string {
  const date = new Date(order.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return `
    <article class="order-card">
      <header>
        <div>
          <strong>#${order.id.slice(0, 6).toUpperCase()}</strong>
          <span class="order-date">${date}</span>
        </div>
        <span class="status status-${order.status}">${order.status}</span>
      </header>
      <ul class="order-lines">
        ${order.items
          .map(
            (line) => `<li>
              <img src="${assetUrl(line.image)}" alt="" loading="lazy" />
              <span>${escapeHtml(line.title)}</span>
              <span class="order-qty">× ${line.quantity}</span>
            </li>`
          )
          .join("")}
      </ul>
      <footer><span>Total</span><strong>${formatPrice(order.total)}</strong></footer>
    </article>
  `;
}

/* ==========================================================================
   SHARED
   ========================================================================== */

export function signedOutMarkup(title: string, message: string): string {
  return `
    <section class="shop-hero">
      <div class="container">
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(message)}</p>
      </div>
    </section>
    <div class="container">
      <div class="empty-state">
        <button class="btn btn-primary" id="gateSignInBtn" type="button">Sign in</button>
      </div>
    </div>
  `;
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
