import { NextResponse } from "next/server";
import { detectIntent } from "@/services/ai/intentService";
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

    const { ocrText, currentDate, businessId } = await request.json();

    if (!businessId) {
      return NextResponse.json(
        { error: "businessId is required." },
        { status: 400 }
      );
    }

    // Authenticate request and authorize business membership
    await authenticateRequest(request, businessId);

    if (!ocrText || !ocrText.trim()) {
      return NextResponse.json(
        { error: "OCR text is required." },
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

    const sanitizedOcr = sanitizeString(ocrText);
    const todayStr = currentDate || new Date().toISOString().split("T")[0];

    // 1. Validate Intent (ensure it is indeed a financial document)
    const intentResult = await detectIntent(sanitizedOcr, apiKey);

    if (intentResult.intent !== "create_transaction") {
      return NextResponse.json(
        { error: "Validation failed: The uploaded document does not appear to be a valid financial receipt." },
        { status: 400 }
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

    // 2. Extract transaction details from the OCR text
    const extractedData = await extractTransaction(
      sanitizedOcr,
      todayStr,
      apiKey,
      incomeCategories,
      expenseCategories
    );

    // Normalize currency symbols to standard ISO 4217 codes
    if (extractedData.currency) {
      const symbolMap: Record<string, string> = {
        "$": "USD",
        "€": "EUR",
        "£": "GBP",
        "¥": "JPY",
        "₹": "INR",
        "A$": "AUD",
        "C$": "CAD",
      };
      const cleanSymbol = extractedData.currency.trim();
      if (symbolMap[cleanSymbol]) {
        extractedData.currency = symbolMap[cleanSymbol];
      } else {
        extractedData.currency = cleanSymbol.toUpperCase();
      }
    }

    // Validate extracted amount and type
    if (typeof extractedData.amount !== "number" || isNaN(extractedData.amount) || extractedData.amount <= 0) {
       extractedData.amount = 0.01; // Safe fallback draft amount
    }

    return NextResponse.json({
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      reason: intentResult.reason,
      extractedData,
    });
  } catch (error) {
    console.error("AI Receipt Scan Extraction error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred during extraction.";
    
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

