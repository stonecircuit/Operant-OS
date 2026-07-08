import { addDoc, collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface AuditLog {
  id?: string;
  businessId: string;
  userId: string;
  userEmail: string;
  action: string;
  details: Record<string, unknown>;
  timestamp: string;
}

/**
 * Creates a new audit log record.
 */
export async function logAction(
  businessId: string,
  userId: string,
  userEmail: string,
  action: string,
  details: Record<string, unknown>
): Promise<void> {
  try {
    await addDoc(collection(db, "audit_logs"), {
      businessId,
      userId,
      userEmail,
      action,
      details,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}

/**
 * Fetches the audit logs for a business.
 */
export async function getAuditLogs(businessId: string, limitCount = 50): Promise<AuditLog[]> {
  try {
    const q = query(
      collection(db, "audit_logs"),
      where("businessId", "==", businessId),
      orderBy("timestamp", "desc"),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as AuditLog[];
  } catch (error) {
    console.error("Failed to retrieve audit logs:", error);
    return [];
  }
}
