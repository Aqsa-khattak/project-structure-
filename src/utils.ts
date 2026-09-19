import type { Product, CategoryDef } from "./types";
import { getAllProducts } from "./productsService";

export const CATEGORIES: CategoryDef[] = [
  { slug: "bags", label: "Bags", match: ["bag", "bags"] },
  { slug: "jewellery", label: "Jewellery", match: ["jewellery", "jewelry"] },
  {
    slug: "office",
    label: "Office & Desk Supplies",
    match: ["office / desk supplies"],
  },
  { slug: "art", label: "Art & Craft", match: ["art & craft"] },
  {
    slug: "everyday",
    label: "Everyday Stationery",
    match: ["everyday stationery", "everyday stationary"],
  },
];

const norm = (s: string): string => s.trim().toLowerCase();

export function getProductCategorySlugs(product: Product): string[] {
  const raw = Array.isArray(product.category)
    ? product.category
    : [product.category];
  const slugs = new Set<string>();
  raw.forEach((c) => {
    const n = norm(c);
    const found = CATEGORIES.find((cat) => cat.match.includes(n));
    if (found) slugs.add(found.slug);
  });
  return Array.from(slugs);
}

export function getProductSubCategories(product: Product): string[] {
  const raw = Array.isArray(product.subCategory)
    ? product.subCategory
    : [product.subCategory];
  return raw.map((s) => s.trim()).filter(Boolean);
}

export function getCategoryLabel(slug: string): string {
  return CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
}

export function getCategoryThumbnail(slug: string): string {
  const match = getAllProducts().find((p) =>
    getProductCategorySlugs(p).includes(slug)
  );
  return match?.image ?? "";
}

export function getSubCategoriesForCategory(slug: string): string[] {
  const seen = new Set<string>();
  getAllProducts().forEach((p) => {
    if (!getProductCategorySlugs(p).includes(slug)) return;
    getProductSubCategories(p).forEach((sc) => seen.add(sc));
  });
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

export function formatPrice(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-IN")}`;
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay = 250
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
