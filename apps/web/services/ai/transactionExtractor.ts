import { GoogleGenerativeAI } from "@google/generative-ai";
import { ExtractedTransactionData } from "./types";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from "@/types/transaction";

export async function extractTransaction(
  message: string,
  currentDate: string,
  apiKey: string,
  incomeCategories?: string[],
  expenseCategories?: string[]
): Promise<ExtractedTransactionData> {
  const todayStr = currentDate || new Date().toISOString().split("T")[0];

  const validIncome = incomeCategories && incomeCategories.length > 0 ? incomeCategories : [...INCOME_CATEGORIES];
  const validExpense = expenseCategories && expenseCategories.length > 0 ? expenseCategories : [...EXPENSE_CATEGORIES];

  const systemPrompt = `You are a helpful financial parsing assistant. Your task is to extract transaction and receipt details from natural language text or raw OCR text and return them in a strict JSON format.

Valid categories are:
- For income transactions:
  - ${validIncome.map((c) => `"${c}"`).join(", ")}
- For expense transactions:
  - ${validExpense.map((c) => `"${c}"`).join(", ")}

You MUST output JSON that matches this schema:
{
  "type": "income" | "expense",
  "amount": number (must be a positive decimal or integer value),
  "category": string (must match one of the valid categories list above),
  "description": string (brief summary of what it was for),
  "date": string (ISO date format YYYY-MM-DD),
  "merchant": string (optional, the business or merchant name e.g. "Slack", "Walmart"),
  "currency": string (optional, the currency code or symbol e.g. "USD", "INR", "$"),
  "confidence": number (decimal between 0.0 and 1.0 representing how confident you are in this extraction)
}

Today's current date is ${todayStr}. If no date is specified in the text, use today's date (${todayStr}). If "yesterday" is mentioned, subtract 1 day from today.

Do NOT add any formatting markdown, code blocks, or explanations. Return ONLY the raw JSON string. If you cannot determine the type, amount, or description, return an empty object {}.`;

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
  if (!responseText || responseText === "{}") {
    throw new Error("Could not extract any transaction details. Please provide more information like amount, type, and description.");
  }

  interface AIResponse {
    type?: string;
    amount?: number | string;
    category?: string;
    description?: string;
    date?: string;
    merchant?: string;
    currency?: string;
    confidence?: number;
  }

  let parsedData: AIResponse;
  try {
    parsedData = JSON.parse(responseText) as AIResponse;
  } catch {
    throw new Error("Failed to parse transaction details from AI response.");
  }

  // Validations
  if (!parsedData.type || !["income", "expense"].includes(parsedData.type)) {
    // If not specified, default to expense for receipts
    parsedData.type = "expense";
  }

  if (typeof parsedData.amount !== "number" || parsedData.amount <= 0) {
    throw new Error("Could not determine a valid transaction amount from the document. Please ensure the receipt total is legible.");
  }

  // Category normalization
  const allCategories = [...validIncome, ...validExpense];

  let matchedCategory = parsedData.category || "";
  if (!allCategories.includes(matchedCategory)) {
    const found = allCategories.find(
      (c) => c.toLowerCase() === matchedCategory.toLowerCase()
    );
    if (found) {
      matchedCategory = found;
    } else {
      matchedCategory = parsedData.type === "income" ? validIncome[0] : validExpense[0];
    }
  }

  if (!parsedData.description || !parsedData.description.trim()) {
    if (parsedData.merchant) {
      parsedData.description = `Purchase at ${parsedData.merchant}`;
    } else {
      parsedData.description = `${matchedCategory} Transaction`;
    }
  }

  // Date normalization
  let matchedDate = parsedData.date || todayStr;
  if (isNaN(Date.parse(matchedDate))) {
    matchedDate = todayStr;
  }

  const finalType = parsedData.type === "income" ? "income" : "expense";

  return {
    type: finalType,
    amount: parsedData.amount as number,
    category: matchedCategory,
    description: parsedData.description.trim(),
    date: matchedDate,
    merchant: typeof parsedData.merchant === "string" ? parsedData.merchant.trim() : undefined,
    currency: typeof parsedData.currency === "string" ? parsedData.currency.trim() : undefined,
    confidence: typeof parsedData.confidence === "number" ? parsedData.confidence : undefined,
  };
}
