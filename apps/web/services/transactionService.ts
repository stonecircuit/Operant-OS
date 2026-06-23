import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type {
  CreateTransactionInput,
  Transaction,
} from "@/types/transaction";

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
  };
}

export async function createTransaction(
  input: CreateTransactionInput
): Promise<Transaction> {
  const amount = Number(input.amount);
  const description =
    input.description.trim();
  const category =
    typeof input.category === "string" ? input.category.trim() : "";

  if (!input.businessId) {
    throw new Error(
      "A business is required to create a transaction."
    );
  }

  if (
    input.type !== "income" &&
    input.type !== "expense"
  ) {
    throw new Error(
      "Transaction type must be income or expense."
    );
  }

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(
      "Amount must be greater than zero."
    );
  }

  if (!description) {
    throw new Error(
      "Description is required."
    );
  }

  if (!category) {
    throw new Error(
      "Category is required."
    );
  }

  const transactionData =
    {
      businessId: input.businessId,
      type: input.type,
      amount,
      description,
      category,
      createdAt:
        new Date().toISOString(),
    } satisfies Omit<Transaction, "id">;

  const result = await addDoc(
    collection(
      db,
      TRANSACTIONS_COLLECTION
    ),
    transactionData
  );

  return {
    id: result.id,
    ...transactionData,
  };
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

  const snapshot = await getDocs(
    transactionsQuery
  );

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

export async function deleteTransaction(
  transactionId: string
): Promise<void> {
  if (!transactionId) {
    throw new Error(
      "Transaction id is required."
    );
  }

  await deleteDoc(
    doc(
      db,
      TRANSACTIONS_COLLECTION,
      transactionId
    )
  );
}
