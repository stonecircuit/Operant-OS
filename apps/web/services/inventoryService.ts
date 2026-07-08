import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  runTransaction,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { retry } from "@/lib/retry";
import { validateProductInput } from "@/lib/validation";
import type { Product, CreateProductInput, InventoryOperation } from "@/types/inventory";

const PRODUCTS_COLLECTION = "products";
const HISTORY_COLLECTION = "inventory_history";

function normalizeProduct(id: string, data: Record<string, unknown>): Product {
  return {
    id,
    businessId: typeof data.businessId === "string" ? data.businessId : "",
    name: typeof data.name === "string" ? data.name : "",
    sku: typeof data.sku === "string" ? data.sku : "",
    category: typeof data.category === "string" ? data.category : "",
    purchasePrice: typeof data.purchasePrice === "number" ? data.purchasePrice : 0,
    sellingPrice: typeof data.sellingPrice === "number" ? data.sellingPrice : 0,
    currentStock: typeof data.currentStock === "number" ? data.currentStock : 0,
    minStock: typeof data.minStock === "number" ? data.minStock : 0,
    unit: typeof data.unit === "string" ? data.unit : "pcs",
    createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
  };
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  const validation = validateProductInput({
    businessId: input.businessId,
    name: input.name,
    sku: input.sku,
    category: input.category,
    purchasePrice: input.purchasePrice,
    sellingPrice: input.sellingPrice,
    minStock: input.minStock,
    unit: input.unit,
  });

  if (!validation.isValid || !validation.sanitized) {
    throw new Error(`Validation failed: ${validation.errors.join("; ")}`);
  }

  const sanitized = validation.sanitized;
  const initialStock = typeof input.initialStock === "number" ? Math.max(0, input.initialStock) : 0;
  const now = new Date().toISOString();

  const productData = {
    ...sanitized,
    currentStock: initialStock,
    createdAt: now,
    updatedAt: now,
  };

  // Add product to Firestore
  const result = await retry(() => addDoc(collection(db, PRODUCTS_COLLECTION), productData));

  // If there's initial stock, log an initial stock in operation
  if (initialStock > 0) {
    try {
      await addDoc(collection(db, HISTORY_COLLECTION), {
        businessId: sanitized.businessId,
        productId: result.id,
        productName: sanitized.name,
        sku: sanitized.sku,
        type: "stock_in",
        quantity: initialStock,
        reason: "Initial Stock Setup",
        notes: "Automatic log during product creation",
        createdAt: now,
        userId: "system",
        userEmail: "system@operantos.com",
      });
    } catch (historyErr) {
      console.error("Failed to log initial stock operation:", historyErr);
    }
  }

  return normalizeProduct(result.id, productData as unknown as Record<string, unknown>);
}

export async function getProducts(businessId: string): Promise<Product[]> {
  if (!businessId) return [];

  const productsQuery = query(
    collection(db, PRODUCTS_COLLECTION),
    where("businessId", "==", businessId)
  );

  const snapshot = await retry(() => getDocs(productsQuery));

  return snapshot.docs
    .map((document) => normalizeProduct(document.id, document.data() as Record<string, unknown>))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getProduct(productId: string): Promise<Product> {
  if (!productId) {
    throw new Error("Product ID is required.");
  }

  const docRef = doc(db, PRODUCTS_COLLECTION, productId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    throw new Error("Product not found.");
  }

  return normalizeProduct(snapshot.id, snapshot.data() as Record<string, unknown>);
}

export async function updateProduct(
  productId: string,
  input: Partial<Omit<Product, "id" | "businessId" | "currentStock">>
): Promise<void> {
  if (!productId) {
    throw new Error("Product ID is required.");
  }

  const docRef = doc(db, PRODUCTS_COLLECTION, productId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    throw new Error("Product record not found.");
  }

  const existingData = snapshot.data();

  // Merge & validate fields
  const mergedInput = {
    businessId: existingData.businessId,
    name: input.name !== undefined ? input.name : existingData.name,
    sku: input.sku !== undefined ? input.sku : existingData.sku,
    category: input.category !== undefined ? input.category : existingData.category,
    purchasePrice: input.purchasePrice !== undefined ? input.purchasePrice : existingData.purchasePrice,
    sellingPrice: input.sellingPrice !== undefined ? input.sellingPrice : existingData.sellingPrice,
    minStock: input.minStock !== undefined ? input.minStock : existingData.minStock,
    unit: input.unit !== undefined ? input.unit : existingData.unit,
  };

  const validation = validateProductInput(mergedInput);
  if (!validation.isValid || !validation.sanitized) {
    throw new Error(`Validation failed: ${validation.errors.join("; ")}`);
  }

  const updateData = {
    ...validation.sanitized,
    updatedAt: new Date().toISOString(),
  };

  await retry(() => updateDoc(docRef, updateData));
}

export async function deleteProduct(productId: string): Promise<void> {
  if (!productId) {
    throw new Error("Product ID is required.");
  }

  await retry(() => deleteDoc(doc(db, PRODUCTS_COLLECTION, productId)));
}

export async function performStockOperation(
  businessId: string,
  productId: string,
  type: "stock_in" | "stock_out",
  quantity: number,
  reason: string,
  notes?: string,
  userId?: string,
  userEmail?: string
): Promise<number> {
  if (quantity <= 0) {
    throw new Error("Quantity must be greater than zero.");
  }

  const productRef = doc(db, PRODUCTS_COLLECTION, productId);

  const newStock = await runTransaction(db, async (transaction) => {
    const productSnap = await transaction.get(productRef);
    if (!productSnap.exists()) {
      throw new Error("Product not found.");
    }
    const productData = productSnap.data();

    if (productData.businessId !== businessId) {
      throw new Error("Unauthorized: Product does not belong to this business.");
    }

    let currentStock = productData.currentStock || 0;
    if (type === "stock_in") {
      currentStock += quantity;
    } else {
      if (currentStock < quantity) {
        throw new Error(`Insufficient stock. Current: ${currentStock} ${productData.unit || "pcs"}, Requested: ${quantity}`);
      }
      currentStock -= quantity;
    }

    // Update product stock
    transaction.update(productRef, {
      currentStock,
      updatedAt: new Date().toISOString(),
    });

    // Create history entry
    const historyRef = doc(collection(db, HISTORY_COLLECTION));
    transaction.set(historyRef, {
      businessId,
      productId,
      productName: productData.name,
      sku: productData.sku,
      type,
      quantity,
      reason,
      notes: notes || "",
      createdAt: new Date().toISOString(),
      userId: userId || "system",
      userEmail: userEmail || "system@operantos.com",
    });

    return currentStock;
  });

  return newStock;
}

export async function getInventoryHistory(businessId: string): Promise<InventoryOperation[]> {
  if (!businessId) return [];

  const historyQuery = query(
    collection(db, HISTORY_COLLECTION),
    where("businessId", "==", businessId)
  );

  const snapshot = await retry(() => getDocs(historyQuery));

  return snapshot.docs
    .map((document) => {
      const data = document.data();
      return {
        id: document.id,
        businessId: data.businessId,
        productId: data.productId,
        productName: data.productName || "",
        sku: data.sku || "",
        type: data.type,
        quantity: data.quantity || 0,
        reason: data.reason || "",
        notes: data.notes,
        createdAt: data.createdAt,
        userId: data.userId || "",
        userEmail: data.userEmail || "",
      } as InventoryOperation;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
