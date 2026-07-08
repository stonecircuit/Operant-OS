export type InsightSeverity = "positive" | "neutral" | "warning";

export interface Insight {
  id: string;
  title: string;
  description: string;
  severity: InsightSeverity;
}
