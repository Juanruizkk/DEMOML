import { IntentType } from "../value-objects/Intent.js";

export type GoldenDecision = "approved" | "edited" | "edited_from_scratch";

export interface GoldenDatasetEntryProps {
  id: string;
  sellerId: string;
  sourceQuestionId: string;
  questionText: string;
  itemSnapshot: Record<string, unknown>;
  llmIntent: IntentType;
  humanIntent: IntentType;
  llmAnswer: string;
  finalAnswer: string;
  decision: GoldenDecision;
  qualityRating: number | null;
  reviewerId: string | null;
  reasoningNote: string | null;
  createdAt?: Date;
}

export class GoldenDatasetEntry {
  public readonly id: string;
  public readonly sellerId: string;
  public readonly sourceQuestionId: string;
  public readonly questionText: string;
  public readonly itemSnapshot: Record<string, unknown>;
  public readonly llmIntent: IntentType;
  public readonly humanIntent: IntentType;
  public readonly llmAnswer: string;
  public readonly finalAnswer: string;
  public readonly decision: GoldenDecision;
  public readonly qualityRating: number | null;
  public readonly reviewerId: string | null;
  public readonly reasoningNote: string | null;
  public readonly createdAt: Date;

  constructor(props: GoldenDatasetEntryProps) {
    this.id = props.id;
    this.sellerId = props.sellerId;
    this.sourceQuestionId = props.sourceQuestionId;
    this.questionText = props.questionText;
    this.itemSnapshot = props.itemSnapshot;
    this.llmIntent = props.llmIntent;
    this.humanIntent = props.humanIntent;
    this.llmAnswer = props.llmAnswer;
    this.finalAnswer = props.finalAnswer;
    this.decision = props.decision;
    this.qualityRating = props.qualityRating;
    this.reviewerId = props.reviewerId;
    this.reasoningNote = props.reasoningNote;
    this.createdAt = props.createdAt ?? new Date();
  }
}
