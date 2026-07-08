/**
 * Utility to validate required environment variables.
 */
export function validateEnvironment(): void {
  const isServer = typeof window === "undefined";

  if (isServer) {
    const requiredServerVars = ["GEMINI_API_KEY"];
    const missing = requiredServerVars.filter((v) => !process.env[v]);

    if (missing.length > 0) {
      const errorMsg = `Production Readiness Error: Missing required server-side environment variables: ${missing.join(
        ", "
      )}. Please configure them in your environment settings.`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
  }

  // Client-side environment variables warning check
  const clientVars = [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
  ];
  const missingClient = clientVars.filter((v) => !process.env[v]);

  if (missingClient.length > 0) {
    console.warn(
      `Security Warning: Missing client-side environment variables: ${missingClient.join(
        ", "
      )}. Using default fallback configurations.`
    );
  }
}

// Run validation immediately on package loading
validateEnvironment();
