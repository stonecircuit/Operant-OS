import { detectIntent } from "./intentService";
import { extractTransaction } from "./transactionExtractor";
import { RouterResult } from "./types";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getTransactions } from "@/services/transactionService";
import { buildProfitLossReport } from "@/lib/reporting";
import { generateInsights } from "@/lib/insights";
import type { Transaction } from "@/types/transaction";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { getProducts } from "@/services/inventoryService";
import { extractInventoryOperation } from "./inventoryExtractor";
import type { Product } from "@/types/inventory";

interface RouterInput {
  businessId: string;
  businessName: string;
  message: string;
  history: { role: string; content: string }[];
  currentDate?: string;
  apiKey: string;
}

export async function routeAIRequest(input: RouterInput): Promise<RouterResult> {
  const todayStr = input.currentDate || new Date().toISOString().split("T")[0];

  // 1. Detect user intent
  const intentResult = await detectIntent(input.message, input.apiKey);

  switch (intentResult.intent) {
    case "financial_question": {
      // Move existing Financial Copilot logic here
      let transactions: Transaction[] = [];
      try {
        transactions = await getTransactions(input.businessId);
      } catch (error) {
        console.error("Firebase getTransactions error in AI Router:", error);
      }

      const report = buildProfitLossReport({
        businessId: input.businessId,
        transactions,
        dateRange: "all-time",
      });

      const insights = generateInsights(report);

      const recentTxList = transactions.slice(0, 20).map((t) => {
        return `- Date: ${new Date(t.createdAt).toLocaleDateString()}, Type: ${t.type}, Category: ${t.category}, Amount: $${t.amount.toFixed(2)}, Desc: ${t.description}`;
      }).join("\n");

      const incomeBreakdownList = report.incomeBreakdown.map((item) => {
        return `- Category: ${item.category}, Total: $${item.amount.toFixed(2)}, Percentage: ${item.percentage.toFixed(1)}%, Count: ${item.transactionCount}`;
      }).join("\n") || "No income categories found.";

      const expenseBreakdownList = report.expenseBreakdown.map((item) => {
        return `- Category: ${item.category}, Total: $${item.amount.toFixed(2)}, Percentage: ${item.percentage.toFixed(1)}%, Count: ${item.transactionCount}`;
      }).join("\n") || "No expense categories found.";

      const insightsTextList = insights.map((ins) => {
        return `- [${ins.severity.toUpperCase()}] ${ins.title}: ${ins.description}`;
      }).join("\n") || "No insights available.";

      const systemPrompt = `You are the AI Financial Copilot for Operant OS, a smart business operating system.
Your goal is to answer the user's financial questions and help them make sense of their business performance.

Use the following real business data as your context to answer. Do NOT invent numbers, categories, or transactions. If the data is empty, state clearly that there are no transactions or reports recorded yet.
Avoid generic financial advice; always customize your responses to this specific business's numbers.
If a question is unrelated to this business's financials or general financial guidance, politely redirect the user back to their business metrics.
Do NOT give tax, accounting, legal, or investment advice.

Active Business Name: ${input.businessName || "Unnamed Business"}
Business ID: ${input.businessId}

=== REPORT SUMMARY (ALL-TIME) ===
- Total Income: $${report.summary.totalIncome.toFixed(2)}
- Total Expenses: $${report.summary.totalExpenses.toFixed(2)}
- Net Profit: $${report.summary.netProfit.toFixed(2)}
- Transaction Count: ${report.summary.transactionCount}

=== INCOME BREAKDOWN ===
${incomeBreakdownList}

=== EXPENSE BREAKDOWN ===
${expenseBreakdownList}

=== AUTOMATED INSIGHTS ===
${insightsTextList}

=== RECENT TRANSACTIONS (UP TO 20) ===
${recentTxList || "No transactions recorded yet."}
`;

      const genAI = new GoogleGenerativeAI(input.apiKey);
      const geminiModel = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: systemPrompt,
      });

      let firstUserIndex = -1;
      for (let i = 0; i < input.history.length; i++) {
        if (input.history[i].role === "user") {
          firstUserIndex = i;
          break;
        }
      }

      const filteredHistory = firstUserIndex !== -1 ? input.history.slice(firstUserIndex) : [];
      const geminiHistory = filteredHistory.map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      }));

      const chat = geminiModel.startChat({ history: geminiHistory });
      const result = await chat.sendMessage(input.message);
      const responseText = result.response.text();

      return {
        intent: "financial_question",
        confidence: intentResult.confidence,
        reason: intentResult.reason,
        response: responseText,
      };
    }

    case "create_transaction": {
      try {
        // Fetch business custom categories
        let incomeCategories: string[] | undefined = undefined;
        let expenseCategories: string[] | undefined = undefined;
        try {
          const bizDoc = await getDoc(doc(db, "businesses", input.businessId));
          if (bizDoc.exists()) {
            const bizData = bizDoc.data();
            incomeCategories = bizData.incomeCategories;
            expenseCategories = bizData.expenseCategories;
          }
        } catch (bizErr) {
          console.warn("Could not fetch business categories for AI prompt: ", bizErr);
        }

        const extracted = await extractTransaction(
          input.message,
          todayStr,
          input.apiKey,
          incomeCategories,
          expenseCategories
        );
        return {
          intent: "create_transaction",
          confidence: intentResult.confidence,
          reason: intentResult.reason,
          response: "I've drafted a transaction based on your request. Please review the details in the confirmation card below to save it to your ledger.",
          extractedData: extracted,
        };
      } catch (err) {
        return {
          intent: "create_transaction",
          confidence: intentResult.confidence,
          reason: intentResult.reason,
          response: err instanceof Error ? err.message : "I could not extract the transaction details. Please provide more details like the type (income/expense), amount, and description.",
        };
      }
    }

    case "general_chat": {
      const genAI = new GoogleGenerativeAI(input.apiKey);
      const geminiModel = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: "You are the friendly AI assistant for Operant OS, a smart business operating system. Respond to greetings and casual inquiries warmly and helpfully, and keep your responses brief. Remind the user that you are ready to help with their business's financial questions (e.g. profit, expenses) or transaction tracking.",
      });

      let firstUserIndex = -1;
      for (let i = 0; i < input.history.length; i++) {
        if (input.history[i].role === "user") {
          firstUserIndex = i;
          break;
        }
      }

      const filteredHistory = firstUserIndex !== -1 ? input.history.slice(firstUserIndex) : [];
      const geminiHistory = filteredHistory.map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      }));

      const chat = geminiModel.startChat({ history: geminiHistory });
      const result = await chat.sendMessage(input.message);
      const responseText = result.response.text();

      return {
        intent: "general_chat",
        confidence: intentResult.confidence,
        reason: intentResult.reason,
        response: responseText,
      };
    }

    case "create_invoice": {
      return {
        intent: "create_invoice",
        confidence: intentResult.confidence,
        reason: intentResult.reason,
        response: "Drafting invoices directly in chat is currently in development for Operant OS v0.2. Soon you will be able to say things like 'Invoice Acme Corp $500 for consulting' and have it draft an editable invoice instantly!",
      };
    }

    case "create_customer": {
      return {
        intent: "create_customer",
        confidence: intentResult.confidence,
        reason: intentResult.reason,
        response: "Customer CRM management is a major milestone in our Operant OS v0.2 roadmap. Soon you'll be able to create customer profiles and contact details directly through this chat!",
      };
    }

    case "schedule_task": {
      return {
        intent: "schedule_task",
        confidence: intentResult.confidence,
        reason: intentResult.reason,
        response: "Task scheduling and business reminders are currently in development for Operant OS v0.2. In the next release, you will be able to schedule tasks and reminders using natural language conversation.",
      };
    }

    case "inventory_action": {
      let products: Product[] = [];
      try {
        products = await getProducts(input.businessId);
      } catch (error) {
        console.error("Firebase getProducts error in AI Router:", error);
      }

      // Check if message looks like an adjustment request
      const isAdjustment = /add|sold|sale|remove|deduct|stock|fill|minus|plus|update/i.test(input.message) && /\d+/.test(input.message);

      if (isAdjustment) {
        try {
          const extracted = await extractInventoryOperation(
            input.message,
            input.apiKey,
            products
          );

          return {
            intent: "inventory_action",
            confidence: intentResult.confidence,
            reason: intentResult.reason,
            response: `I've drafted an inventory adjustment based on your request. Please review the details in the confirmation card below to log it to your inventory history.`,
            extractedInventoryData: extracted,
          };
        } catch (err) {
          console.warn("Inventory extraction failed, falling back to conversational answer:", err);
        }
      }

      // Answer conversationally using the products list context
      const lowStockList = products
        .filter((p) => p.currentStock <= p.minStock)
        .map((p) => `- ${p.name} (SKU: ${p.sku}): ${p.currentStock} ${p.unit} remaining (min limit: ${p.minStock})`)
        .join("\n") || "No items are low on stock.";

      const inventoryVal = products.reduce(
        (acc, p) => acc + p.currentStock * p.purchasePrice,
        0
      );
      const inventorySellingVal = products.reduce(
        (acc, p) => acc + p.currentStock * p.sellingPrice,
        0
      );
      const totalUnits = products.reduce((acc, p) => acc + p.currentStock, 0);

      const productsListText = products
        .map(
          (p) =>
            `- ${p.name} (SKU: ${p.sku}): ${p.currentStock} ${p.unit} in stock. Purchase Price: $${p.purchasePrice.toFixed(2)}, Selling Price: $${p.sellingPrice.toFixed(2)}. Value: $${(p.currentStock * p.purchasePrice).toFixed(2)}`
        )
        .join("\n") || "No products in inventory.";

      const systemPrompt = `You are the AI Financial and Inventory Copilot for Operant OS, a smart business operating system.
Your goal is to answer the user's questions about inventory levels, low stock products, quantities, and inventory valuations.

Use the following real business data as your context to answer. Do NOT invent numbers, products, or stock levels. If the inventory is empty, state clearly that there are no products recorded yet.
Avoid generic advice; always customize your responses to this specific business's numbers.

Active Business Name: ${input.businessName || "Unnamed Business"}
Business ID: ${input.businessId}

=== INVENTORY METRICS ===
- Total Products: ${products.length}
- Total Inventory Units: ${totalUnits}
- Total Inventory Asset Value (at purchase cost): $${inventoryVal.toFixed(2)}
- Total Inventory Selling Value: $${inventorySellingVal.toFixed(2)}

=== LOW STOCK PRODUCTS ===
${lowStockList}

=== PRODUCT LIST ===
${productsListText}
`;

      const genAI = new GoogleGenerativeAI(input.apiKey);
      const geminiModel = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: systemPrompt,
      });

      let firstUserIndex = -1;
      for (let i = 0; i < input.history.length; i++) {
        if (input.history[i].role === "user") {
          firstUserIndex = i;
          break;
        }
      }

      const filteredHistory = firstUserIndex !== -1 ? input.history.slice(firstUserIndex) : [];
      const geminiHistory = filteredHistory.map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      }));

      const chat = geminiModel.startChat({ history: geminiHistory });
      const result = await chat.sendMessage(input.message);
      const responseText = result.response.text();

      return {
        intent: "inventory_action",
        confidence: intentResult.confidence,
        reason: intentResult.reason,
        response: responseText,
      };
    }

    case "generate_report": {
      return {
        intent: "generate_report",
        confidence: intentResult.confidence,
        reason: intentResult.reason,
        response: "Custom report generation (PDF and Excel downloads) is coming soon in Operant OS v0.2. In future updates, you'll be able to request report builds and get download links directly in your chat.",
      };
    }

    case "unknown":
    default: {
      return {
        intent: "unknown",
        confidence: intentResult.confidence,
        reason: intentResult.reason,
        response: "I'm not sure how to process that. Could you please clarify if you'd like to ask a financial question (e.g., 'How is my business doing?'), or log a transaction (e.g., 'Spent $50 on software yesterday')?",
      };
    }
  }
}
