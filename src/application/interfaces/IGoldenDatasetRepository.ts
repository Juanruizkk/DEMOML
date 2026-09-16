import { GoldenDatasetEntry, GoldenDecision } from "../../domain/entities/GoldenDatasetEntry.js";
import { IntentType } from "../../domain/value-objects/Intent.js";

export interface GoldenDatasetFilters {
  intent?: IntentType;
  decision?: GoldenDecision;
  limit?: number;
  offset?: number;
}

export interface GoldenDatasetMetrics {
  total: number;
  byDecision: Record<GoldenDecision, number>;
  byIntent: Record<string, number>;
  intentMismatchRate: number;
  avgQualityRating: number | null;
}

export interface IGoldenDatasetRepository {
  save(entry: GoldenDatasetEntry): Promise<void>;
  findBySellerId(sellerId: string, filters?: GoldenDatasetFilters): Promise<GoldenDatasetEntry[]>;
  getMetricsBySellerId(sellerId: string): Promise<GoldenDatasetMetrics>;
}
