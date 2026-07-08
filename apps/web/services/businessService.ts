import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { Business } from "@/types/business";
import { retry } from "@/lib/retry";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from "@/types/transaction";

export type { Business };

export async function createBusiness(
  ownerId: string,
  name: string
) {
  console.log("businessService started");

  const result = await retry(() =>
    addDoc(
      collection(db, "businesses"),
      {
        ownerId,
        name,
        createdAt: new Date().toISOString(),
        currency: "USD",
        timezone: "UTC",
        financialYear: "Jan-Dec",
        country: "US",
        members: {
          [ownerId]: "owner"
        },
        incomeCategories: [...INCOME_CATEGORIES],
        expenseCategories: [...EXPENSE_CATEGORIES],
      }
    )
  );

  console.log("businessService finished");

  return result;
}

export async function getBusinesses(
  ownerId: string
): Promise<Business[]> {
  const businessesQuery = query(
    collection(db, "businesses"),
    where(`members.${ownerId}`, "in", ["owner", "admin", "staff"])
  );

  const snapshot = await retry(() => getDocs(businessesQuery));

  return snapshot.docs.map((document) => {
    const data = document.data();

    return {
      id: document.id,
      ownerId: data.ownerId,
      name: data.name,
      createdAt: data.createdAt,
      currency: data.currency || "USD",
      timezone: data.timezone || "UTC",
      financialYear: data.financialYear || "Jan-Dec",
      country: data.country || "US",
      description: data.description,
      address: data.address,
      taxId: data.taxId,
      members: data.members,
      preferences: data.preferences,
      incomeCategories: data.incomeCategories,
      expenseCategories: data.expenseCategories,
    } as Business;
  });
}

export async function updateBusiness(
  businessId: string,
  data: Partial<Omit<Business, "id" | "ownerId" | "createdAt">>
): Promise<void> {
  const businessDocRef = doc(db, "businesses", businessId);
  await retry(() => updateDoc(businessDocRef, data));
}