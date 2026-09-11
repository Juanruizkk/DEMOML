export interface ModerationResult {
  blocked: boolean;
  reason: string | null;
  matchedRule?: string;
}
