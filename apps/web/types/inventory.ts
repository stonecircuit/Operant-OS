export interface Product {
  id: string;
  businessId: string;
  name: string;
  sku: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  currentStock: number;
  minStock: number;
  unit: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateProductInput = Omit<Product, "id" | "currentStock" | "createdAt" | "updatedAt"> & {
  initialStock?: number;
};

export interface InventoryOperation {
  id?: string;
  businessId: string;
  productId: string;
  productName: string;
  sku: string;
  type: "stock_in" | "stock_out";
  quantity: number;
  reason: string;
  notes?: string;
  createdAt: string;
  userId: string;
  userEmail: string;
}
