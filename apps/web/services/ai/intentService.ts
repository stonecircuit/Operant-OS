import { GoogleGenerativeAI } from "@google/generative-ai";
import { IntentResult, IntentType } from "./types";

export async function detectIntent(message: string, apiKey: string): Promise<IntentResult> {
  const systemPrompt = `You are the Intent Recognition Engine for Operant OS, a smart business operating system.
Your job is to analyze the user's message and determine their intent.

You must classify the intent into one of the following categories:
1. "financial_question": The user is asking about business performance, cash flow, revenue, expenses, trends, insights, profit, or general financial metrics. (e.g., "how is my business doing?", "show me the profit report", "what's my biggest expense?")
2. "create_transaction": The user is describing a transaction (income or expense) that they want to record, add, or log. (e.g., "I spent $50 on software today", "recorded $500 revenue from a client", "log a payment of 100 for travel")
3. "inventory_action": The user is performing an inventory stock adjustment (e.g., "Add 20 CPUs to stock", "Sold 5 laptops", "remove 3 boxes") or querying inventory levels, low stock products, stock quantities, or overall inventory valuation (e.g., "Which items are low on stock?", "How many keyboards do I have?", "What's my inventory value?").
4. "general_chat": The user is greeting, saying thanks, or making casual, non-business chat. (e.g., "hello", "hi there", "thanks", "how are you?")
5. "unknown": The user's query is ambiguous, doesn't match the other categories, or is completely unrelated. (e.g., "what is the speed of light?", "blue sky", random words)

We also plan to support the following intents in the future. If the user's query matches one of these, classify it as that intent:
- "create_invoice" (e.g., "create an invoice for client X", "bill company Y $200")
- "create_customer" (e.g., "add a new customer named John Doe", "create customer profile")
- "schedule_task" (e.g., "schedule a reminder for tomorrow", "remind me to pay rent")
- "generate_report" (e.g., "generate a tax report", "create a PDF report for last month")

Output MUST be a valid JSON object matching this schema:
{
  "intent": "financial_question" | "create_transaction" | "inventory_action" | "general_chat" | "unknown" | "create_invoice" | "create_customer" | "schedule_task" | "generate_report",
  "confidence": number (float between 0.0 and 1.0 representing your confidence level),
  "reason": string (brief 1-sentence explanation of why you chose this intent)
}

Do NOT wrap the output in markdown code blocks or add any other text. Return ONLY the raw JSON string.`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
      systemInstruction: systemPrompt,
    });

    const result = await geminiModel.generateContent({
      contents: [{ role: "user", parts: [{ text: message }] }],
    });

    const responseText = result.response.text().trim();
    if (!responseText) {
      return {
        intent: "unknown",
        confidence: 1.0,
        reason: "Received empty response from intent recognition model.",
      };
    }

    const parsed = JSON.parse(responseText);

    const validIntents: IntentType[] = [
      "financial_question",
      "create_transaction",
      "general_chat",
      "unknown",
      "create_invoice",
      "create_customer",
      "schedule_task",
      "inventory_action",
      "generate_report",
    ];

    const intent = validIntents.includes(parsed.intent) ? (parsed.intent as IntentType) : "unknown";
    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.5;
    const reason = typeof parsed.reason === "string" ? parsed.reason : "Classified automatically.";

    return { intent, confidence, reason };
  } catch (error) {
    console.error("Error detecting intent:", error);
    return {
      intent: "unknown",
      confidence: 0.0,
      reason: `Error during classification: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
