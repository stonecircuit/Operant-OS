import { GoogleGenerativeAI } from "@google/generative-ai";
import { ExtractedInventoryData } from "./types";

export async function extractInventoryOperation(
  message: string,
  apiKey: string,
  products: { id: string; name: string; sku: string }[]
): Promise<ExtractedInventoryData> {
  const productsText =
    products
      .map((p) => `- ID: ${p.id}, Name: ${p.name}, SKU: ${p.sku}`)
      .join("\n") || "No products found.";

  const systemPrompt = `You are a helpful inventory parsing assistant for Operant OS. Your task is to analyze natural language messages and extract inventory stock adjustments.

Here is the list of existing products for the business:
${productsText}

You must extract:
1. Product matching: Identify which product name or SKU is being targeted.
2. Operation type: Is it a stock increase ("stock_in") or stock decrease/sale/loss ("stock_out")?
3. Quantity: A positive number (quantity to adjust).
4. Reason: A concise description of the adjustment (e.g., "Sold 5 items", "AI Stock Adjustment", "Manual Stock In").

If you find a match in the products list above, set "productId" to the matching Product's ID, and "productName" to its exact name.
If you do not find a match but a product name is mentioned, set "productId" to null or empty, and "productName" to the mentioned name.

You MUST output JSON that matches this schema:
{
  "productId": string | null,
  "productName": string,
  "type": "stock_in" | "stock_out",
  "quantity": number (must be a positive number),
  "reason": string,
  "notes": string (optional, any additional details)
}

Do NOT wrap the output in markdown code blocks or add any other text. Return ONLY the raw JSON string. If you cannot determine the operation details (e.g. it's a general question and not an adjustment command), return an empty object {}.`;

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
    throw new Error(
      "Could not extract stock operation details. Please specify quantity and product name (e.g., 'Add 20 CPUs to stock' or 'Sold 5 laptops')."
    );
  }

  const parsed = JSON.parse(responseText);

  if (!parsed.type || !["stock_in", "stock_out"].includes(parsed.type)) {
    throw new Error("Could not determine if it is a stock_in or stock_out operation.");
  }

  if (typeof parsed.quantity !== "number" || parsed.quantity <= 0) {
    throw new Error("Could not extract a valid quantity (must be greater than 0).");
  }

  return {
    productId: parsed.productId || undefined,
    productName: parsed.productName || "Unknown Product",
    type: parsed.type,
    quantity: parsed.quantity,
    reason: parsed.reason || "AI Adjustment",
    notes: parsed.notes,
  };
}
