import { NextResponse } from "next/server";
import { routeAIRequest } from "@/services/ai/router";
import { authenticateRequest } from "@/lib/apiAuth";
import { sanitizeString } from "@/lib/validation";
import { getClientIp, isRateLimited } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

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

    const { businessId, businessName, message, history = [] } = await request.json();

    if (!businessId) {
      return NextResponse.json(
        { error: "businessId is required." },
        { status: 400 }
      );
    }

    // Authenticate user and verify business membership
    await authenticateRequest(request, businessId);

    if (!message) {
      return NextResponse.json(
        { error: "message is required." },
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

    const sanitizedMessage = sanitizeString(message);
    const todayStr = new Date().toISOString().split("T")[0];

    const result = await routeAIRequest({
      businessId,
      businessName,
      message: sanitizedMessage,
      history,
      currentDate: todayStr,
      apiKey,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("AI Router API error in Copilot server route:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred on the server.";
    
    // Distinguish auth errors (401) from processing errors (500)
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

