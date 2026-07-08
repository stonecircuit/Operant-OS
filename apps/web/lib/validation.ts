import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from "@/types/transaction";

/**
 * Validates whether an email is in a correct format.
 */
export function validateEmail(email: string): boolean {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validates a currency code (must be a valid ISO 4217 3-character currency code).
 */
export function validateCurrencyCode(code: string): boolean {
  if (!code || typeof code !== "string" || !/^[A-Z]{3}$/.test(code.toUpperCase().trim())) {
    return false;
  }
  try {
    // Check if the currency code is recognized by Intl as a valid ISO 4217 currency code
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code.toUpperCase().trim(),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitizes input strings by trimming whitespace and stripping HTML tags.
 * Does not escape to HTML entities to prevent double-escaping inside React templates
 * and to keep text clean for AI/API processing.
 */
export function sanitizeString(value: string): string {
  if (!value) return "";
  // Strip HTML tags using regex
  const stripped = value.replace(/<[^>]*>/g, "");
  return stripped.trim();
}

export interface TransactionValidationInput {
  businessId: string;
  type: string;
  amount: number | string;
  description: string;
  category: string;
  createdAt?: string;
  merchant?: string;
  currency?: string;
}

export interface TransactionValidationResult {
  isValid: boolean;
  errors: string[];
  sanitized?: {
    businessId: string;
    type: "income" | "expense";
    amount: number;
    description: string;
    category: string;
    createdAt: string;
    merchant?: string;
    currency?: string;
  };
}

/**
 * Validates transaction input values.
 */
export function validateTransactionInput(
  data: TransactionValidationInput,
  customIncomeCategories?: string[],
  customExpenseCategories?: string[]
): TransactionValidationResult {
  const errors: string[] = [];

  // 1. Business ID check
  const cleanBusinessId = sanitizeString(data.businessId);
  if (!cleanBusinessId) {
    errors.push("Business ID is required.");
  }

  // 2. Type validation
  if (data.type !== "income" && data.type !== "expense") {
    errors.push("Transaction type must be strictly 'income' or 'expense'.");
  }

  // 3. Amount validation (finite, positive, non-NaN)
  const amountNum = typeof data.amount === "number" ? data.amount : Number(data.amount);
  if (isNaN(amountNum) || !Number.isFinite(amountNum) || amountNum <= 0) {
    errors.push("Amount must be a valid, positive number greater than zero.");
  }

  // 4. Category validation against supported categories
  const cleanCategory = sanitizeString(data.category);
  if (!cleanCategory) {
    errors.push("Category is required.");
  } else {
    if (data.type === "income") {
      const validIncome = (customIncomeCategories && customIncomeCategories.length > 0) ? customIncomeCategories : [...INCOME_CATEGORIES] as string[];
      if (!validIncome.includes(cleanCategory)) {
        errors.push(`Invalid income category '${cleanCategory}'. Allowed categories are: ${validIncome.join(", ")}.`);
      }
    } else if (data.type === "expense") {
      const validExpense = (customExpenseCategories && customExpenseCategories.length > 0) ? customExpenseCategories : [...EXPENSE_CATEGORIES] as string[];
      if (!validExpense.includes(cleanCategory)) {
        errors.push(`Invalid expense category '${cleanCategory}'. Allowed categories are: ${validExpense.join(", ")}.`);
      }
    }
  }

  // 5. Description validation (trim, length limits)
  const cleanDesc = sanitizeString(data.description);
  if (!cleanDesc) {
    errors.push("Description is required.");
  } else if (cleanDesc.length > 255) {
    errors.push("Description must not exceed 255 characters.");
  }

  // 6. Date validation
  let finalCreatedAt = data.createdAt ? data.createdAt.trim() : "";
  if (finalCreatedAt) {
    const timestamp = Date.parse(finalCreatedAt);
    if (isNaN(timestamp)) {
      errors.push("Invalid date format.");
    } else {
      const dateObj = new Date(timestamp);
      const year = dateObj.getFullYear();
      if (year < 2000 || year > 2100) {
        errors.push("Transaction date must be between the years 2000 and 2100.");
      } else {
        finalCreatedAt = dateObj.toISOString();
      }
    }
  } else {
    finalCreatedAt = new Date().toISOString();
  }

  // 7. Optional Merchant validation (trim, length limits)
  let cleanMerchant: string | undefined = undefined;
  if (data.merchant !== undefined && data.merchant !== null) {
    cleanMerchant = sanitizeString(data.merchant);
    if (cleanMerchant && cleanMerchant.length > 100) {
      errors.push("Merchant name must not exceed 100 characters.");
    }
  }

  // 8. Optional Currency validation (ISO 4217 validation)
  let cleanCurrency: string | undefined = undefined;
  if (data.currency) {
    cleanCurrency = sanitizeString(data.currency).toUpperCase();
    if (!validateCurrencyCode(cleanCurrency)) {
      errors.push(`Currency code '${cleanCurrency}' is not a valid ISO 4217 currency code (e.g. USD, EUR, INR).`);
    }
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
    };
  }

  return {
    isValid: true,
    errors: [],
    sanitized: {
      businessId: cleanBusinessId,
      type: data.type as "income" | "expense",
      amount: amountNum,
      description: cleanDesc,
      category: cleanCategory,
      createdAt: finalCreatedAt,
      merchant: cleanMerchant || undefined,
      currency: cleanCurrency || undefined,
    },
  };
}

export interface ProductValidationInput {
  businessId: string;
  name: string;
  sku: string;
  category: string;
  purchasePrice: number | string;
  sellingPrice: number | string;
  minStock: number | string;
  unit: string;
}

export interface ProductValidationResult {
  isValid: boolean;
  errors: string[];
  sanitized?: {
    businessId: string;
    name: string;
    sku: string;
    category: string;
    purchasePrice: number;
    sellingPrice: number;
    minStock: number;
    unit: string;
  };
}

export function validateProductInput(data: ProductValidationInput): ProductValidationResult {
  const errors: string[] = [];

  const cleanBusinessId = sanitizeString(data.businessId);
  if (!cleanBusinessId) {
    errors.push("Business ID is required.");
  }

  const cleanName = sanitizeString(data.name);
  if (!cleanName) {
    errors.push("Product name is required.");
  } else if (cleanName.length > 100) {
    errors.push("Product name must not exceed 100 characters.");
  }

  const cleanSku = sanitizeString(data.sku);
  if (!cleanSku) {
    errors.push("SKU is required.");
  } else if (cleanSku.length > 50) {
    errors.push("SKU must not exceed 50 characters.");
  }

  const cleanCategory = sanitizeString(data.category);
  if (!cleanCategory) {
    errors.push("Category is required.");
  }

  const purchasePriceNum = typeof data.purchasePrice === "number" ? data.purchasePrice : Number(data.purchasePrice);
  if (isNaN(purchasePriceNum) || purchasePriceNum < 0) {
    errors.push("Purchase price must be a non-negative number.");
  }

  const sellingPriceNum = typeof data.sellingPrice === "number" ? data.sellingPrice : Number(data.sellingPrice);
  if (isNaN(sellingPriceNum) || sellingPriceNum < 0) {
    errors.push("Selling price must be a non-negative number.");
  }

  const minStockNum = typeof data.minStock === "number" ? data.minStock : Number(data.minStock);
  if (isNaN(minStockNum) || minStockNum < 0) {
    errors.push("Minimum stock must be a non-negative number.");
  }

  const cleanUnit = sanitizeString(data.unit);
  if (!cleanUnit) {
    errors.push("Unit (e.g. pcs, kg) is required.");
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    sanitized: {
      businessId: cleanBusinessId,
      name: cleanName,
      sku: cleanSku,
      category: cleanCategory,
      purchasePrice: purchasePriceNum,
      sellingPrice: sellingPriceNum,
      minStock: minStockNum,
      unit: cleanUnit,
    },
  };
}

