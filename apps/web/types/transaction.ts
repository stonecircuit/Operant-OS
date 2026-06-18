export interface Transaction {
  id: string;
  businessId: string;
  type: "sale" | "expense";
  amount: number;
  description: string;
  createdAt: string;
}