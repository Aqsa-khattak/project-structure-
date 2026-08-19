
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