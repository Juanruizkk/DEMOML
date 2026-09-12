import { describe, it, expect, vi } from "vitest";
import { HandleWhatsAppReplyUseCase } from "../application/use-cases/HandleWhatsAppReplyUseCase.js";
import { ApproveAnswerUseCase } from "../application/use-cases/ApproveAnswerUseCase.js";
import { RejectAnswerUseCase } from "../application/use-cases/RejectAnswerUseCase.js";
import { IEventRepository } from "../application/interfaces/IEventRepository.js";
import { IWhatsAppClient } from "../application/interfaces/IWhatsAppClient.js";

function makeUseCase() {
  const approveUseCase = {
    execute: vi.fn().mockResolvedValue({ id: "123", sellerId: "seller1" }),
  } as unknown as ApproveAnswerUseCase;

  const rejectUseCase = {
    execute: vi.fn().mockResolvedValue({ id: "123" }),
  } as unknown as RejectAnswerUseCase;

  const eventRepo: IEventRepository = {
    log: vi.fn().mockResolvedValue(undefined),
    getRecent: vi.fn().mockResolvedValue([]),
    getRecentBySellerId: vi.fn().mockResolvedValue([]),
  };

  const whatsAppClient: IWhatsAppClient = {
    sendTextMessage: vi.fn().mockResolvedValue(undefined),
    sendInteractiveButtons: vi.fn().mockResolvedValue(undefined),
    sendTemplate: vi.fn().mockResolvedValue(undefined),
  };

  const useCase = new HandleWhatsAppReplyUseCase(approveUseCase, rejectUseCase, eventRepo, whatsAppClient);
  return { useCase, approveUseCase, rejectUseCase, eventRepo, whatsAppClient };
}

describe("HandleWhatsAppReplyUseCase", () => {
  it("routes approve_ button to ApproveAnswerUseCase", async () => {
    const { useCase, approveUseCase, whatsAppClient } = makeUseCase();
    await useCase.execute({ from: "+5491112345678", buttonReplyId: "approve_9001" });

    expect(approveUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ questionId: "9001" })
    );
    expect(whatsAppClient.sendTextMessage).toHaveBeenCalledWith(
      expect.objectContaining({ to: "+5491112345678", text: expect.stringContaining("publicada") })
    );
  });

  it("routes reject_ button to RejectAnswerUseCase", async () => {
    const { useCase, rejectUseCase, whatsAppClient } = makeUseCase();
    await useCase.execute({ from: "+5491112345678", buttonReplyId: "reject_9002" });

    expect(rejectUseCase.execute).toHaveBeenCalledWith("9002");
    expect(whatsAppClient.sendTextMessage).toHaveBeenCalledWith(
      expect.objectContaining({ to: "+5491112345678", text: expect.stringContaining("descartada") })
    );
  });

  it("logs claim_ack and sends confirmation", async () => {
    const { useCase, eventRepo, whatsAppClient } = makeUseCase();
    await useCase.execute({ from: "+5491112345678", buttonReplyId: "claim_ack_5000000001" });

    expect(eventRepo.log).toHaveBeenCalledWith(
      expect.objectContaining({ type: "claim_ack" })
    );
    expect(whatsAppClient.sendTextMessage).toHaveBeenCalledWith(
      expect.objectContaining({ to: "+5491112345678", text: expect.stringContaining("reclamo") })
    );
  });

  it("sends fallback message for unrecognized payload", async () => {
    const { useCase, approveUseCase, rejectUseCase, whatsAppClient } = makeUseCase();
    await useCase.execute({ from: "+5491112345678", text: "hola que tal" });

    expect(approveUseCase.execute).not.toHaveBeenCalled();
    expect(rejectUseCase.execute).not.toHaveBeenCalled();
    expect(whatsAppClient.sendTextMessage).toHaveBeenCalledOnce();
  });
});
