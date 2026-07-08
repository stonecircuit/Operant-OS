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
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type {
  CreateTransactionInput,
  Transaction,
} from "@/types/transaction";
import { retry } from "@/lib/retry";
import { validateTransactionInput } from "@/lib/validation";

const TRANSACTIONS_COLLECTION =
  "transactions";

function normalizeTransaction(
  id: string,
  data: Partial<Omit<Transaction, "id">>
): Transaction {
  if (
    data.type !== "income" &&
    data.type !== "expense"
  ) {
    throw new Error(
      "Transaction has an invalid type."
    );
  }

  if (
    typeof data.businessId !== "string" ||
    typeof data.amount !== "number" ||
    typeof data.description !== "string" ||
    typeof data.createdAt !== "string"
  ) {
    throw new Error(
      "Transaction record is malformed."
    );
  }

  const category =
    typeof data.category === "string" && data.category.trim()
      ? data.category.trim()
      : data.type === "income"
      ? "Revenue"
      : "Miscellaneous";

  return {
    id,
    businessId: data.businessId,
    type: data.type,
    amount: data.amount,
    description: data.description,
    category,
    createdAt: data.createdAt,
    merchant: typeof data.merchant === "string" ? data.merchant : undefined,
    currency: typeof data.currency === "string" ? data.currency : undefined,
  };
}

export async function createTransaction(
  input: CreateTransactionInput
): Promise<Transaction> {
  // Fetch business document to get custom categories
  let customIncome: string[] | undefined = undefined;
  let customExpense: string[] | undefined = undefined;
  try {
    const bizSnap = await getDoc(doc(db, "businesses", input.businessId));
    if (bizSnap.exists()) {
      const bizData = bizSnap.data();
      customIncome = bizData.incomeCategories;
      customExpense = bizData.expenseCategories;
    }
  } catch (err) {
    console.warn("Could not load business categories for validation:", err);
  }

  const validation = validateTransactionInput({
    businessId: input.businessId,
    type: input.type,
    amount: input.amount,
    description: input.description,
    category: input.category,
    createdAt: input.createdAt,
    merchant: input.merchant,
    currency: input.currency,
  }, customIncome, customExpense);

  if (!validation.isValid || !validation.sanitized) {
    throw new Error(`Validation failed: ${validation.errors.join("; ")}`);
  }

  const {
    businessId,
    type,
    amount,
    description,
    category,
    createdAt,
    merchant,
    currency,
  } = validation.sanitized;

  const transactionData: Record<string, unknown> = {
    businessId,
    type,
    amount,
    description,
    category,
    createdAt,
  };

  if (merchant !== undefined) {
    transactionData.merchant = merchant;
  }
  if (currency !== undefined) {
    transactionData.currency = currency;
  }

  const result = await retry(() =>
    addDoc(
      collection(
        db,
        TRANSACTIONS_COLLECTION
      ),
      transactionData
    )
  );

  return {
    id: result.id,
    ...transactionData,
  } as Transaction;
}

export async function getTransactions(
  businessId: string
): Promise<Transaction[]> {
  if (!businessId) {
    return [];
  }

  const transactionsQuery = query(
    collection(
      db,
      TRANSACTIONS_COLLECTION
    ),
    where("businessId", "==", businessId)
  );

  const snapshot = await retry(() => getDocs(transactionsQuery));

  return snapshot.docs
    .map((document) =>
      normalizeTransaction(
        document.id,
        document.data()
      )
    )
    .sort(
      (first, second) =>
        new Date(
          second.createdAt
        ).getTime() -
        new Date(first.createdAt).getTime()
    );
}

export async function getTransactionsPaginated(
  businessId: string,
  pageSize: number,
  options: {
    type?: string;
    category?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    searchQuery?: string;
    lastDocSnapshot?: QueryDocumentSnapshot | null;
  } = {}
): Promise<{ transactions: Transaction[]; lastVisible: QueryDocumentSnapshot | null }> {
  if (!businessId) {
    return { transactions: [], lastVisible: null };
  }

  const { type, category, startDate, endDate, sortBy, searchQuery, lastDocSnapshot } = options;

  let transactionsQuery = query(
    collection(db, TRANSACTIONS_COLLECTION),
    where("businessId", "==", businessId)
  );

  // Apply equality filters
  if (type && type !== "all") {
    transactionsQuery = query(transactionsQuery, where("type", "==", type));
  }
  if (category && category !== "all") {
    transactionsQuery = query(transactionsQuery, where("category", "==", category));
  }

  const isSearching = !!(searchQuery && searchQuery.trim());

  // Apply date range filters if present and not searching (to avoid multi-inequality query errors)
  if (!isSearching) {
    if (startDate) {
      transactionsQuery = query(transactionsQuery, where("createdAt", ">=", startDate));
    }
    if (endDate) {
      const endLimit = new Date(endDate);
      endLimit.setHours(23, 59, 59, 999);
      transactionsQuery = query(transactionsQuery, where("createdAt", "<=", endLimit.toISOString()));
    }
  }

  // Apply search query (prefix search on description)
  if (isSearching) {
    const searchVal = searchQuery!.trim();
    transactionsQuery = query(
      transactionsQuery,
      orderBy("description"),
      where("description", ">=", searchVal),
      where("description", "<=", searchVal + "\uf8ff")
    );
  } else {
    // Apply sorting
    // If date range filters are active, the first orderBy must be 'createdAt'
    // fallback to 'date-desc' if sorted by other fields during active date range filters
    const hasDateFilter = !!(startDate || endDate);
    const effectiveSortBy = (hasDateFilter && sortBy && !sortBy.startsWith("date")) ? "date-desc" : sortBy;

    if (effectiveSortBy === "amount-desc") {
      transactionsQuery = query(transactionsQuery, orderBy("amount", "desc"), orderBy("createdAt", "desc"));
    } else if (effectiveSortBy === "amount-asc") {
      transactionsQuery = query(transactionsQuery, orderBy("amount", "asc"), orderBy("createdAt", "desc"));
    } else if (effectiveSortBy === "date-asc") {
      transactionsQuery = query(transactionsQuery, orderBy("createdAt", "asc"));
    } else if (effectiveSortBy === "desc-asc") {
      transactionsQuery = query(transactionsQuery, orderBy("description", "asc"), orderBy("createdAt", "desc"));
    } else if (effectiveSortBy === "desc-desc") {
      transactionsQuery = query(transactionsQuery, orderBy("description", "desc"), orderBy("createdAt", "desc"));
    } else {
      // Default: date-desc
      transactionsQuery = query(transactionsQuery, orderBy("createdAt", "desc"));
    }
  }

  // Apply limit
  transactionsQuery = query(transactionsQuery, limit(pageSize));

  // Apply cursor
  if (lastDocSnapshot) {
    transactionsQuery = query(transactionsQuery, startAfter(lastDocSnapshot));
  }

  try {
    const snapshot = await retry(() => getDocs(transactionsQuery));
    const transactions = snapshot.docs.map((document) =>
      normalizeTransaction(document.id, document.data())
    );

    const lastVisible = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] as QueryDocumentSnapshot : null;

    return {
      transactions,
      lastVisible,
    };
  } catch (error) {
    const err = error as { code?: string; message?: string };
    if (err.code === "failed-precondition" || err.message?.includes("index")) {
      console.warn("Firestore composite index missing, falling back to client-side sorting/filtering/pagination:", err.message);
      
      const allTx = await getTransactions(businessId);
      
      // 1. Type filtering
      let filtered = allTx;
      if (type && type !== "all") {
        filtered = filtered.filter((t) => t.type === type);
      }
      
      // 2. Category filtering
      if (category && category !== "all") {
        filtered = filtered.filter((t) => t.category === category);
      }
      
      // 3. Search query (prefix search on description)
      if (isSearching) {
        const searchVal = searchQuery!.trim().toLowerCase();
        filtered = filtered.filter((t) => t.description.toLowerCase().startsWith(searchVal));
      } else {
        // 4. Date range filtering (only when not searching)
        if (startDate) {
          filtered = filtered.filter((t) => t.createdAt >= startDate);
        }
        if (endDate) {
          const endLimit = new Date(endDate);
          endLimit.setHours(23, 59, 59, 999);
          const endLimitStr = endLimit.toISOString();
          filtered = filtered.filter((t) => t.createdAt <= endLimitStr);
        }
      }
      
      // 5. Sorting
      const hasDateFilter = !!(startDate || endDate);
      const effectiveSortBy = (hasDateFilter && sortBy && !sortBy.startsWith("date")) ? "date-desc" : sortBy;

      if (effectiveSortBy === "amount-desc") {
        filtered.sort((a, b) => b.amount - a.amount || b.createdAt.localeCompare(a.createdAt));
      } else if (effectiveSortBy === "amount-asc") {
        filtered.sort((a, b) => a.amount - b.amount || b.createdAt.localeCompare(a.createdAt));
      } else if (effectiveSortBy === "date-asc") {
        filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      } else if (effectiveSortBy === "desc-asc") {
        filtered.sort((a, b) => a.description.localeCompare(b.description) || b.createdAt.localeCompare(a.createdAt));
      } else if (effectiveSortBy === "desc-desc") {
        filtered.sort((a, b) => b.description.localeCompare(a.description) || b.createdAt.localeCompare(a.createdAt));
      } else {
        // Default: date-desc
        filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      }

      // 6. Pagination & Cursor mapping
      let startIndex = 0;
      if (lastDocSnapshot) {
        const idx = filtered.findIndex((t) => t.id === lastDocSnapshot.id);
        if (idx !== -1) {
          startIndex = idx + 1;
        }
      }

      const paginated = filtered.slice(startIndex, startIndex + pageSize);

      let lastVisible: QueryDocumentSnapshot | null = null;
      if (paginated.length > 0) {
        const lastTx = paginated[paginated.length - 1];
        try {
          const lastDocRef = doc(db, TRANSACTIONS_COLLECTION, lastTx.id);
          lastVisible = await getDoc(lastDocRef) as QueryDocumentSnapshot;
        } catch (docErr) {
          console.warn("Could not fetch cursor document snapshot:", docErr);
        }
      }

      return {
        transactions: paginated,
        lastVisible,
      };
    } else {
      throw error;
    }
  }
}

export async function deleteTransaction(
  transactionId: string
): Promise<void> {
  if (!transactionId) {
    throw new Error(
      "Transaction id is required."
    );
  }

  await retry(() =>
    deleteDoc(
      doc(
        db,
        TRANSACTIONS_COLLECTION,
        transactionId
      )
    )
  );
}

export async function updateTransaction(
  id: string,
  input: Partial<Omit<Transaction, "id" | "businessId">>
): Promise<void> {
  if (!id) {
    throw new Error("Transaction id is required.");
  }

  const docRef = doc(db, TRANSACTIONS_COLLECTION, id);
  const existingSnapshot = await getDoc(docRef);
  if (!existingSnapshot.exists()) {
    throw new Error("Transaction record not found.");
  }
  const existingData = existingSnapshot.data();

  // Merge existing fields with input updates to validate full record consistency
  const mergedInput = {
    businessId: existingData.businessId,
    type: input.type !== undefined ? input.type : existingData.type,
    amount: input.amount !== undefined ? input.amount : existingData.amount,
    description: input.description !== undefined ? input.description : existingData.description,
    category: input.category !== undefined ? input.category : existingData.category,
    createdAt: input.createdAt !== undefined ? input.createdAt : existingData.createdAt,
    merchant: input.merchant !== undefined ? input.merchant : existingData.merchant,
    currency: input.currency !== undefined ? input.currency : existingData.currency,
  };

  // Fetch business document to get custom categories
  let customIncome: string[] | undefined = undefined;
  let customExpense: string[] | undefined = undefined;
  try {
    const bizSnap = await getDoc(doc(db, "businesses", existingData.businessId));
    if (bizSnap.exists()) {
      const bizData = bizSnap.data();
      customIncome = bizData.incomeCategories;
      customExpense = bizData.expenseCategories;
    }
  } catch (err) {
    console.warn("Could not load business categories for validation:", err);
  }

  const validation = validateTransactionInput(mergedInput, customIncome, customExpense);
  if (!validation.isValid || !validation.sanitized) {
    throw new Error(`Validation failed: ${validation.errors.join("; ")}`);
  }

  const { type, amount, description, category, createdAt, merchant, currency } = validation.sanitized;

  const updateData: Record<string, unknown> = {
    type,
    amount,
    description,
    category,
    createdAt,
    merchant: merchant || null,
    currency: currency || null,
  };

  await retry(() => updateDoc(docRef, updateData));
}
