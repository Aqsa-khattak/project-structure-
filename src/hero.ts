import { goToShop } from "./state";

interface Slide {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  categorySlug?: string;
  image: string;
}

const SLIDES: Slide[] = [
  {
    eyebrow: "Welcome to Papernest",
    title: "Shop Cute Finds From Anywhere",
    subtitle:
      "Bags, jewellery & stationery you'll love — browse the whole shop in one easy scroll.",
    ctaLabel: "Shop All",
    image: "/assets/banners/carousal_1.jpg",
  },
  {
    eyebrow: "Get Creative",
    title: "Art & Craft Supplies You'll Love",
    subtitle:
      "Brushes, paints & sketchbooks to bring your next creative burst to life.",
    ctaLabel: "Shop Art & Craft",
    categorySlug: "art",
    image: "/assets/banners/carousal_2.jpg",
  },
  {
    eyebrow: "Back To School",
    title: "Everything For Your Study Desk",
    subtitle:
      "Notebooks, colour pencils & watercolours to make studying a little more fun.",
    ctaLabel: "Shop Stationery",
    categorySlug: "everyday",
    image: "/assets/banners/carousal_3.jpg",
  },
  {
    eyebrow: "Desk Goals",
    title: "Colour Your Everyday",
    subtitle:
      "Pens, rulers & desk essentials in every shade you can imagine.",
    ctaLabel: "Shop Office & Desk",
    categorySlug: "office",
    image: "/assets/banners/carousal_4.jpg",
  },
  {
    eyebrow: "Little Treats",
    title: "Cute Cards & Gifting Finds",
    subtitle:
      "Handpicked little somethings for the moments worth celebrating.",
    ctaLabel: "Explore Everything",
    image: "/assets/banners/carousal_5.jpg",
  },
];

let currentSlide = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const AUTOPLAY_MS = 5000;

export function renderHero(container: HTMLElement): void {
  const count = SLIDES.length;
  currentSlide = 0;

  container.innerHTML = `
    <section class="hero">
      <div class="hero-track" id="heroTrack" style="width:${count * 100}%;">
        ${SLIDES.map(
          (s) => `
          <div class="hero-slide" style="width:${100 / count}%; background-image:url('${s.image}')">
            <div class="hero-content">
              <span class="section-eyebrow">${s.eyebrow}</span>
              <h1>${s.title}</h1>
              <p>${s.subtitle}</p>
              <button class="btn btn-primary" data-cat="${s.categorySlug ?? ""}" type="button">${s.ctaLabel} →</button>
            </div>
          </div>`
        ).join("")}
      </div>
      <button class="hero-nav hero-prev" type="button" aria-label="Previous slide">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 4 7 12 15 20"></polyline></svg>
      </button>
      <button class="hero-nav hero-next" type="button" aria-label="Next slide">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 4 17 12 9 20"></polyline></svg>
      </button>
      <div class="hero-dots">
        ${SLIDES.map((_, i) => `<button class="hero-dot${i === 0 ? " active" : ""}" type="button" data-index="${i}" aria-label="Go to slide ${i + 1}"></button>`).join("")}
      </div>
    </section>

    <div class="container">
      <div class="trust-strip">
        <div class="trust-item">
          <span class="t-icon">🚚</span>
          <div><div class="t-title">Free Shipping</div><div class="t-sub">On orders over ₹999</div></div>
        </div>
        <div class="trust-item">
          <span class="t-icon">🎀</span>
          <div><div class="t-title">Handpicked Cute</div><div class="t-sub">Curated with love</div></div>
        </div>
        <div class="trust-item">
          <span class="t-icon">↩️</span>
          <div><div class="t-title">Easy Returns</div><div class="t-sub">7 day return window</div></div>
        </div>
        <div class="trust-item">
          <span class="t-icon">💳</span>
          <div><div class="t-title">Secure Payments</div><div class="t-sub">100% protected checkout</div></div>
        </div>
      </div>
    </div>
  `;

  const track = document.getElementById("heroTrack") as HTMLElement;
  const dots = container.querySelectorAll<HTMLButtonElement>(".hero-dot");
  const slideWidthPct = 100 / count;

  function goTo(index: number): void {
    currentSlide = (index + count) % count;
    track.style.transform = `translateX(-${currentSlide * slideWidthPct}%)`;
    dots.forEach((d, i) => d.classList.toggle("active", i === currentSlide));
  }

  function restartAutoplay(): void {
    if (timer) clearInterval(timer);
    timer = setInterval(() => goTo(currentSlide + 1), AUTOPLAY_MS);
  }

  container.querySelector(".hero-prev")!.addEventListener("click", () => {
    goTo(currentSlide - 1);
    restartAutoplay();
  });

  container.querySelector(".hero-next")!.addEventListener("click", () => {
    goTo(currentSlide + 1);
    restartAutoplay();
  });

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      goTo(Number(dot.dataset.index));
      restartAutoplay();
    });
  });

  container.querySelectorAll<HTMLButtonElement>(".hero-content .btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cat = btn.dataset.cat;
      goToShop(cat ? { category: cat } : {});
    });
  });

  const heroSection = container.querySelector<HTMLElement>(".hero")!;
  heroSection.addEventListener("mouseenter", () => {
    if (timer) clearInterval(timer);
  });
  heroSection.addEventListener("mouseleave", restartAutoplay);

  goTo(0);
  restartAutoplay();
}

export function stopHeroAutoplay(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
