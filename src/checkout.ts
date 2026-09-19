import { clearCart, getCartTotal, cart, navigate } from "./state";
import { formatPrice } from "./utils";
import { placeOrder } from "./orders";
import { requireAuth, getDisplayName } from "./auth";
import { showToast, closeCart } from "./cart";
import { isFirebaseConfigured } from "./firebase";

/** Ask for delivery details, then write the order to Firestore. */
export function openCheckout(): void {
  if (!cart.length) return;

  requireAuth(() => {
    if (!isFirebaseConfigured) {
      showToast("Connect Firebase in src/firebase.ts to place orders");
      return;
    }
    closeCart();
    renderCheckout();
  }, "Sign in to place your order");
}

function renderCheckout(): void {
  const root = document.getElementById("checkout-root");
  if (!root) return;

  root.innerHTML = `
    <div class="modal-overlay" id="checkoutOverlay">
      <div class="checkout-box">
        <button class="modal-close" id="checkoutCloseBtn" aria-label="Close">✕</button>
        <h2>Delivery details</h2>
        <p class="checkout-hello">Almost there, ${escapeHtml(getDisplayName())} — where should we send it?</p>

        <form class="auth-form" id="checkoutForm" novalidate>
          <div class="auth-field">
            <label for="coPhone">Phone number</label>
            <input type="tel" id="coPhone" placeholder="03XX XXXXXXX" required />
          </div>
          <div class="auth-field">
            <label for="coAddress">Delivery address</label>
            <textarea id="coAddress" rows="3" placeholder="House, street, area, city" required></textarea>
          </div>

          <div class="checkout-total">
            <span>Total payable</span>
            <strong>${formatPrice(getCartTotal())}</strong>
          </div>

          <p class="auth-error" id="checkoutError"></p>
          <button type="submit" class="btn btn-primary btn-block" id="placeOrderBtn">Place order</button>
        </form>
      </div>
    </div>
  `;

  const overlay = document.getElementById("checkoutOverlay")!;
  requestAnimationFrame(() => overlay.classList.add("open"));

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeCheckout();
  });
  document.getElementById("checkoutCloseBtn")!.addEventListener("click", closeCheckout);
  document.getElementById("checkoutForm")!.addEventListener("submit", onSubmit);
}

async function onSubmit(e: Event): Promise<void> {
  e.preventDefault();

  const phone = (document.getElementById("coPhone") as HTMLInputElement).value.trim();
  const address = (document.getElementById("coAddress") as HTMLTextAreaElement).value.trim();
  const errorEl = document.getElementById("checkoutError")!;
  const btn = document.getElementById("placeOrderBtn") as HTMLButtonElement;

  if (phone.length < 7) {
    errorEl.textContent = "Add a phone number we can reach you on.";
    return;
  }
  if (address.length < 10) {
    errorEl.textContent = "Add a full address so the courier can find you.";
    return;
  }

  errorEl.textContent = "";
  btn.disabled = true;
  btn.textContent = "Placing your order…";

  try {
    await placeOrder({ phone, address });
    clearCart();
    closeCheckout();
    showToast("Order placed! You'll find it in your dashboard.");
    navigate("account");
  } catch (err) {
    console.error(err);
    errorEl.textContent = "We couldn't place the order. Please try again.";
    btn.disabled = false;
    btn.textContent = "Place order";
  }
}

function closeCheckout(): void {
  const overlay = document.getElementById("checkoutOverlay");
  if (!overlay) return;
  overlay.classList.remove("open");
  setTimeout(() => {
    const root = document.getElementById("checkout-root");
    if (root) root.innerHTML = "";
  }, 250);
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
