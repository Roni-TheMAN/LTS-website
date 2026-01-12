export enum View {
  DASHBOARD = 'dashboard',
  ORDERS = 'orders',
  ORDER_DETAIL = 'order_detail',
  PRODUCTS = 'products',
  PRODUCT_DETAIL = 'product_detail',
  VARIANT_EDITOR = 'variant_editor',
  KEYCARDS = 'keycards',
  MEDIA = 'media',
  STRIPE = 'stripe',
  SETTINGS = 'settings',
}

export interface Order {
  id: string;
  customer: string;
  status: 'Fulfilled' | 'Processing' | 'Unfulfilled' | 'Cancelled';
  payment: 'Paid' | 'Unpaid' | 'Refunded';
  total: string;
  date: string;
}

export interface Brand {
  id: number;
  name: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface Product {
  id: number | string;
  name: string;
  brand_id?: number;
  category_id?: number;
  brand?: string; // Legacy support or computed
  category?: string; // Legacy support or computed
  type: 'Physical' | 'Service' | 'Keycard';
  active: boolean;
  variants: number;
  image?: string;
  icon?: any;
}
