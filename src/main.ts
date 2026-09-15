import "../style.css";

import { renderNavbar } from "./navbar";
import { renderHero, stopHeroAutoplay } from "./hero";
import {
  renderHomeSections,
  renderShopPage,
  refreshShopPageIfMounted,
  teardownHomeSections,
} from "./products";
import { setupSearch } from "./search";
import { setupCart } from "./cart";
import { bus, currentView, goToShop, setView } from "./state";

function renderFooter(): void {
  const footer = document.getElementById("site-footer")!;
  footer.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <a href="#home" class="brand">Paper<span class="brand-dot">nest</span></a>
          <p>Cute, cosy stationery, bags &amp; jewellery — handpicked to make your everyday a little more delightful.</p>
        </div>
        <div class="footer-col">
          <h4>Categories</h4>
          <ul>
            <li><a href="#shop" data-cat="bags">Bags</a></li>
            <li><a href="#shop" data-cat="jewellery">Jewellery</a></li>
            <li><a href="#shop" data-cat="office">Office &amp; Desk</a></li>
            <li><a href="#shop" data-cat="art">Art &amp; Craft</a></li>
            <li><a href="#shop" data-cat="everyday">Everyday Stationery</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Help</h4>
          <ul>
            <li><a href="#">Shipping &amp; Returns</a></li>
            <li><a href="#">Track Order</a></li>
            <li><a href="#">FAQs</a></li>
            <li><a href="#">Contact Us</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Follow</h4>
          <ul>
            <li><a href="#">Instagram</a></li>
            <li><a href="#">Pinterest</a></li>
            <li><a href="#">TikTok</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">© ${new Date().getFullYear()} Papernest. All rights reserved.</div>
    </div>
  `;

  footer.querySelectorAll<HTMLAnchorElement>("[data-cat]").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      goToShop({ category: a.dataset.cat ?? null });
    });
  });
}

function renderApp(): void {
  const app = document.getElementById("app")!;
  stopHeroAutoplay();
  teardownHomeSections();
  app.innerHTML = "";

  if (currentView === "shop") {
    renderShopPage(app);
  } else {
    const heroContainer = document.createElement("div");
    app.appendChild(heroContainer);
    renderHero(heroContainer);
    renderHomeSections(app);
  }

  window.scrollTo(0, 0);
}

function syncViewFromHash(): void {
  const hash = window.location.hash.replace("#", "");
  setView(hash === "shop" ? "shop" : "home");
}

function init(): void {
  renderNavbar();
  renderFooter();
  setupSearch();
  setupCart();

  syncViewFromHash();

  bus.on("view:change", renderApp);
  bus.on("filters:change", () => {
    if (currentView === "shop") refreshShopPageIfMounted();
  });

  window.addEventListener("hashchange", syncViewFromHash);

  renderApp();
}

document.addEventListener("DOMContentLoaded", init);