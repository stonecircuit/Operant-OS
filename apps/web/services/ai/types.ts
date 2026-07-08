import type { TransactionType } from "@/types/transaction";

export type IntentType =
  | "financial_question"
  | "create_transaction"
  | "general_chat"
  | "unknown"
  // Scalable/future intents
  | "create_invoice"
  | "create_customer"
  | "schedule_task"
  | "inventory_action"
  | "generate_report";

export interface IntentResult {
  intent: IntentType;
  confidence: number;
  reason: string;
}

export interface ExtractedTransactionData {
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  date: string; // YYYY-MM-DD
  merchant?: string;
  currency?: string;
  confidence?: number;
}

export interface ExtractedInventoryData {
  productId?: string;
  productName?: string;
  type: "stock_in" | "stock_out";
  quantity: number;
  reason: string;
  notes?: string;
}

export interface RouterResult {
  intent: IntentType;
  confidence: number;
  reason: string;
  response: string;
  extractedData?: ExtractedTransactionData;
  extractedInventoryData?: ExtractedInventoryData;
}
