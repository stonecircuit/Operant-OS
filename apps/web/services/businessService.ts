import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export interface Business {
  id: string;
  ownerId: string;
  name: string;
  createdAt: string;
}

export async function createBusiness(
  ownerId: string,
  name: string
) {
  console.log("businessService started");

  const result = await addDoc(
    collection(db, "businesses"),
    {
      ownerId,
      name,
      createdAt:
        new Date().toISOString(),
    }
  );

  console.log("businessService finished");

  return result;
}

export async function getBusinesses(
  ownerId: string
): Promise<Business[]> {
  const businessesQuery = query(
    collection(db, "businesses"),
    where("ownerId", "==", ownerId)
  );

  const snapshot = await getDocs(
    businessesQuery
  );

  return snapshot.docs.map((document) => {
    const data =
      document.data() as Omit<Business, "id">;

    return {
      id: document.id,
      ...data,
    };
  });
}