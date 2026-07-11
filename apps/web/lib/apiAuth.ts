import { adminDb } from "./FirebaseAdmin";

export interface AuthenticatedUser {
  uid: string;
  email: string;
  role: "owner" | "admin" | "staff";
}

// Client API key used to verify client ID tokens server-side
const FIREBASE_API_KEY =
  process.env.FIREBASE_API_KEY ||
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
  "AIzaSyB_SF_i0bh1y1E1cvi4Le6J0_p23cpszsc";

/**
 * Validates the Authorization header and checks user membership on the requested business.
 */
export async function authenticateRequest(
  request: Request,
  businessId?: string
): Promise<AuthenticatedUser> {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or malformed Authorization header.");
  }

  const idToken = authHeader.split("Bearer ")[1].trim();

  if (!idToken) {
    throw new Error("Auth token is empty.");
  }

  // Verify ID Token with Firebase Auth REST API
  const lookupUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`;

  const response = await fetch(lookupUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    throw new Error("Invalid or expired authentication token.");
  }

  const result = await response.json();
  const userRecord = result.users?.[0];

  if (!userRecord || !userRecord.localId) {
    throw new Error("Authentication failed: User record not found.");
  }

  const uid = userRecord.localId;
  const email = userRecord.email || "";

  // If a businessId is provided, authorize membership and extract their role
  if (businessId) {
    const businessSnapshot = await adminDb
      .collection("businesses")
      .doc(businessId)
      .get();

    if (!businessSnapshot.exists) {
      throw new Error("Business ledger not found.");
    }

    const businessData = businessSnapshot.data();

    if (!businessData) {
      throw new Error("Business data is empty.");
    }

    let role: "owner" | "admin" | "staff" | null = null;

    if (businessData.ownerId === uid) {
      role = "owner";
    } else if (businessData.members && businessData.members[uid]) {
      role = businessData.members[uid];
    }

    if (!role) {
      throw new Error("User does not have access permissions for this business.");
    }

    return {
      uid,
      email,
      role,
    };
  }

  // If no businessId is provided, return with a default role
  return {
    uid,
    email,
    role: "staff",
  };
}