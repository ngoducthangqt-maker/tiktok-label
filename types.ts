export interface ProductItem {
  code: string; // e.g., "TP8039"
  qty: number;  // e.g., 1
  raw: string;  // e.g., "TP8039*1"
}

export interface OrderData {
  pageNumber: number;
  trackingId: string;
  products: ProductItem[];
  totalQty: number;
  isMulti: boolean; // True if "Đơn ghép"
  note: string;
}

export interface ProcessingStats {
  totalOrders: number;
  singleOrders: number;
  multiOrders: number;
  totalPages: number;
}
