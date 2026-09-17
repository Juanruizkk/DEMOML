import { GoldenDatasetEntry } from "../../domain/entities/GoldenDatasetEntry.js";
import { ModerationService } from "../../domain/services/ModerationService.js";
import { IntentType } from "../../domain/value-objects/Intent.js";

export interface EvalInput {
  entry: GoldenDatasetEntry;
  llmOutput: {
    intent: IntentType;
    answer: string;
    confidence: number;
  };
}

export interface EvalFailure {
  questionText: string;
  reason: string;
  expected: string;
  got: string;
}

export interface EvalResult {
  totalEntries: number;
  passed: number;
  failed: number;
  failureRate: number;
  failures: EvalFailure[];
}

export function runEval(inputs: EvalInput[]): EvalResult {
  const failures: EvalFailure[] = [];

  for (const { entry, llmOutput } of inputs) {
    // Check 1: intent match
    if (llmOutput.intent !== entry.humanIntent) {
      failures.push({
        questionText: entry.questionText,
        reason: `intent incorrecto`,
        expected: entry.humanIntent,
        got: llmOutput.intent,
      });
      continue;
    }

    // Check 2: moderation
    const modResult = ModerationService.moderate(llmOutput.answer);
    if (modResult.blocked) {
      failures.push({
        questionText: entry.questionText,
        reason: `moderación bloqueada: ${modResult.reason}`,
        expected: "respuesta sin contenido bloqueado",
        got: llmOutput.answer.slice(0, 100),
      });
    }
  }

  const passed = inputs.length - failures.length;
  return {
    totalEntries: inputs.length,
    passed,
    failed: failures.length,
    failureRate: inputs.length > 0 ? failures.length / inputs.length : 0,
    failures,
  };
}
