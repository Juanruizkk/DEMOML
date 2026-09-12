import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProcessClaimUseCase } from "../application/use-cases/ProcessClaimUseCase.js";
import { IClaimRepository } from "../application/interfaces/IClaimRepository.js";
import { ITenantRepository } from "../application/interfaces/ITenantRepository.js";
import { IEventRepository } from "../application/interfaces/IEventRepository.js";
import { IMeliClient, MeliClaimDTO } from "../application/interfaces/IMeliClient.js";
import { IWhatsAppClient } from "../application/interfaces/IWhatsAppClient.js";
import { IRealtimeNotifier } from "../application/interfaces/IRealtimeNotifier.js";
import { Tenant } from "../domain/entities/Tenant.js";

function makeMockClaim(): MeliClaimDTO {
  return {
    id: 5000000001,
    resource_id: 2000000001,
    status: "opened",
    type: "mediations",
    stage: "claim",
    reason_id: "PNR3430",
    players: [
      {
        role: "complainant",
        type: "buyer",
        user_id: 9999,
        available_actions: [],
      },
      {
        role: "respondent",
        type: "seller",
        user_id: 1111,
        available_actions: [
          {
            action: "send_message_to_complainant",
            due_date: new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString(),
            mandatory: true,
          },
        ],
      },
    ],
    date_created: new Date().toISOString(),
    last_updated: new Date().toISOString(),
  };
}

function makeUseCase() {
  const claimRepo: IClaimRepository = {
    save: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(null),
    listBySellerId: vi.fn().mockResolvedValue([]),
  };

  // ITenantRepository: findById, findBySellerId, save, getAll
  const tenantRepo: ITenantRepository = {
    findById: vi.fn().mockResolvedValue(null),
    findBySellerId: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    getAll: vi.fn().mockResolvedValue([]),
  };

  // IEventRepository: log, getRecent, getRecentBySellerId
  const eventRepo: IEventRepository = {
    log: vi.fn().mockResolvedValue(undefined),
    getRecent: vi.fn().mockResolvedValue([]),
    getRecentBySellerId: vi.fn().mockResolvedValue([]),
  };

  const meliClient = {
    getClaim: vi.fn().mockResolvedValue(makeMockClaim()),
    getQuestion: vi.fn(),
    getItem: vi.fn(),
    postAnswer: vi.fn(),
    getReceivedQuestions: vi.fn(),
    getSellerProfile: vi.fn(),
    exchangeCodeForTokens: vi.fn(),
    refreshTokens: vi.fn(),
  } as unknown as IMeliClient;

  const whatsAppClient: IWhatsAppClient = {
    sendTextMessage: vi.fn().mockResolvedValue(undefined),
    sendInteractiveButtons: vi.fn().mockResolvedValue(undefined),
    sendTemplate: vi.fn().mockResolvedValue(undefined),
  };

  // IRealtimeNotifier: broadcast, broadcastToSeller
  const sseNotifier: IRealtimeNotifier = {
    broadcast: vi.fn(),
    broadcastToSeller: vi.fn(),
  };

  const useCase = new ProcessClaimUseCase(
    claimRepo,
    tenantRepo,
    eventRepo,
    meliClient,
    whatsAppClient,
    sseNotifier
  );

  return { useCase, claimRepo, tenantRepo, meliClient, whatsAppClient, sseNotifier, eventRepo };
}

describe("ProcessClaimUseCase", () => {
  it("fetches claim from ML and persists it", async () => {
    const { useCase, claimRepo, meliClient } = makeUseCase();
    const claim = await useCase.execute({ claimId: "5000000001", sellerId: "1111" });

    expect(meliClient.getClaim).toHaveBeenCalledWith("1111", "5000000001");
    expect(claimRepo.save).toHaveBeenCalled();
    expect(claim).not.toBeNull();
    expect(claim?.type).toBe("med_pnr");
    expect(claim?.orderId).toBe("2000000001");
  });

  it("does NOT send WhatsApp when tenant has no whatsappAlertPhone", async () => {
    const { useCase, tenantRepo, whatsAppClient } = makeUseCase();
    vi.mocked(tenantRepo.findBySellerId).mockResolvedValue(null);

    await useCase.execute({ claimId: "5000000001", sellerId: "1111" });

    expect(whatsAppClient.sendInteractiveButtons).not.toHaveBeenCalled();
  });

  it("sends WhatsApp when tenant has whatsappAlertPhone", async () => {
    const { useCase, tenantRepo, whatsAppClient } = makeUseCase();
    const mockTenant = {
      settings: { whatsappAlertPhone: "+5491112345678", autoAnswerEnabled: true, confidenceThreshold: 0.75, tone: "casual_rioplatense" },
    } as unknown as Tenant;
    vi.mocked(tenantRepo.findBySellerId).mockResolvedValue(mockTenant);

    await useCase.execute({ claimId: "5000000001", sellerId: "1111" });

    expect(whatsAppClient.sendInteractiveButtons).toHaveBeenCalledOnce();
    const callArg = vi.mocked(whatsAppClient.sendInteractiveButtons).mock.calls[0][0];
    expect(callArg.to).toBe("+5491112345678");
    expect(callArg.buttons[0].id).toBe("claim_ack_5000000001");
  });

  it("broadcasts SSE event", async () => {
    const { useCase, sseNotifier } = makeUseCase();
    await useCase.execute({ claimId: "5000000001", sellerId: "1111" });
    expect(sseNotifier.broadcastToSeller).toHaveBeenCalledWith("1111", "claim_received", expect.any(Object));
  });

  it("maps PDD reason_id to med_pdd type", async () => {
    const { useCase, meliClient } = makeUseCase();
    const pddClaim = { ...makeMockClaim(), reason_id: "PDD9549" };
    vi.mocked(meliClient.getClaim).mockResolvedValue(pddClaim);

    const claim = await useCase.execute({ claimId: "5000000001", sellerId: "1111" });
    expect(claim?.type).toBe("med_pdd");
  });
});
