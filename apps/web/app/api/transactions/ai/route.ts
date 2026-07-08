import { NextResponse } from "next/server";
import { extractTransaction } from "@/services/ai/transactionExtractor";
import { authenticateRequest } from "@/lib/apiAuth";
import { sanitizeString } from "@/lib/validation";
import { getClientIp, isRateLimited } from "@/lib/rateLimit";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export async function POST(request: Request) {
  try {
    // 1. Rate Limiting Check
    const ip = getClientIp(request);
    if (isRateLimited(ip, 30)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before submitting more queries." },
        { status: 429 }
      );
    }

    const { message, currentDate, businessId } = await request.json();

    if (!businessId) {
      return NextResponse.json(
        { error: "businessId is required." },
        { status: 400 }
      );
    }

    // Authenticate user and verify business membership
    await authenticateRequest(request, businessId);

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: "Message input is required." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key is not configured on the server. Please add GEMINI_API_KEY to your environment variables." },
        { status: 500 }
      );
    }

    // Fetch business custom categories
    let incomeCategories: string[] | undefined = undefined;
    let expenseCategories: string[] | undefined = undefined;
    try {
      const bizDoc = await getDoc(doc(db, "businesses", businessId));
      if (bizDoc.exists()) {
        const bizData = bizDoc.data();
        incomeCategories = bizData.incomeCategories;
        expenseCategories = bizData.expenseCategories;
      }
    } catch (bizErr) {
      console.warn("Could not fetch business categories for AI prompt: ", bizErr);
    }

    const sanitizedMessage = sanitizeString(message);
    const todayStr = currentDate || new Date().toISOString().split("T")[0];

    const extracted = await extractTransaction(
      sanitizedMessage,
      todayStr,
      apiKey,
      incomeCategories,
      expenseCategories
    );

    // Normalize currency symbols to standard ISO 4217 codes
    if (extracted.currency) {
      const symbolMap: Record<string, string> = {
        "$": "USD",
        "€": "EUR",
        "£": "GBP",
        "¥": "JPY",
        "₹": "INR",
        "A$": "AUD",
        "C$": "CAD",
      };
      const cleanSymbol = extracted.currency.trim();
      if (symbolMap[cleanSymbol]) {
        extracted.currency = symbolMap[cleanSymbol];
      } else {
        extracted.currency = cleanSymbol.toUpperCase();
      }
    }

    // Validate extracted amount and type
    if (typeof extracted.amount !== "number" || isNaN(extracted.amount) || extracted.amount <= 0) {
      extracted.amount = 0.01; // Safe fallback draft amount
    }

    return NextResponse.json(extracted);
  } catch (error) {
    console.error("AI Transaction Entry Route error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    
    // Distinguish auth errors (401) from processing errors (400/500)
    const isAuthError = errorMessage.includes("Authorization") || 
                        errorMessage.includes("token") || 
                        errorMessage.includes("Authentication") || 
                        errorMessage.includes("permissions");
                        
    return NextResponse.json(
      { error: errorMessage },
      { status: isAuthError ? 401 : 500 }
    );
  }
}

