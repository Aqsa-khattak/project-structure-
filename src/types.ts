
export interface Product {
  id: number;
  title: string;
  price: number;
  image: string;
  category: string | string[];
  subCategory: string | string[];
  inStock: boolean;
  description?: string[]; 
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type ViewName = "home" | "shop";

export type SortOption =
  | "featured"
  | "price-asc"
  | "price-desc"
  | "name-asc"
  | "name-desc";

export interface ShopFilters {
  category: string | null;
  subCategory: string | null;
  search: string;
  sort: SortOption;
}

export interface CategoryDef {
  slug: string;
  label: string;
  match: string[];
  image?: string;
}