import { describe, it, expect, beforeEach, vi } from "vitest";
import { GetGlobalMetricsUseCase } from "../../src/application/use-cases/admin/GetGlobalMetricsUseCase.js";
import { ListTenantsOverviewUseCase } from "../../src/application/use-cases/admin/ListTenantsOverviewUseCase.js";
import { ToggleTenantAutoAnswerUseCase } from "../../src/application/use-cases/admin/ToggleTenantAutoAnswerUseCase.js";
import { Tenant } from "../../src/domain/entities/Tenant.js";

describe("Admin Use Cases (Super Admin Dashboard)", () => {
  let mockQuestionRepo: any;
  let mockTenantRepo: any;
  let mockEventRepo: any;

  beforeEach(() => {
    mockQuestionRepo = {
      getCountsByStatus: vi.fn().mockResolvedValue({
        total: 100,
        auto_answered: 75,
        approved: 15,
        pending_review: 8,
        rejected: 2,
        error: 0,
      }),
      getAverageLatency: vi.fn().mockResolvedValue(1250),
      getIntentDistribution: vi.fn().mockResolvedValue({
        stock: 60,
        envio: 20,
        caracteristicas: 10,
        precio_negociacion: 10,
      }),
      getStatsBySellerId: vi.fn().mockResolvedValue({
        total: 45,
        autoAnswered: 40,
      }),
    };

    const tenants = [
      Tenant.createDefault({
        id: "s1",
        sellerId: "SELLER_1",
        accessToken: "t1",
        refreshToken: "r1",
        expiresInSec: 3600 * 5, // 5 hours (healthy)
        nickname: "Tienda Oficial 1",
      }),
      Tenant.createDefault({
        id: "s2",
        sellerId: "SELLER_2",
        accessToken: "t2",
        refreshToken: "r2",
        expiresInSec: 60 * 5, // 5 minutes (expiring_soon)
        nickname: "Tienda Oficial 2",
      }),
    ];

    mockTenantRepo = {
      getAll: vi.fn().mockResolvedValue(tenants),
      findBySellerId: vi.fn(async (id: string) => tenants.find((t) => t.sellerId === id) || null),
      save: vi.fn().mockResolvedValue(undefined),
    };

    mockEventRepo = {
      log: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("debe calcular métricas globales con porcentaje de auto-respuesta correcto", async () => {
    const useCase = new GetGlobalMetricsUseCase(mockQuestionRepo, mockTenantRepo);
    const metrics = await useCase.execute();

    expect(metrics.totalQuestions).toBe(100);
    expect(metrics.autoAnsweredCount).toBe(75);
    expect(metrics.approvedCount).toBe(15);
    // (75 + 15) / 100 = 90%
    expect(metrics.autoAnswerRatePercent).toBe(90);
    expect(metrics.averageLatencyMs).toBe(1250);
    expect(metrics.totalActiveTenants).toBe(2);
    expect(metrics.intentDistribution.stock).toBe(60);
  });

  it("debe clasificar la salud de tokens OAuth en el listado de tenants", async () => {
    const useCase = new ListTenantsOverviewUseCase(mockTenantRepo, mockQuestionRepo);
    const overviews = await useCase.execute();

    expect(overviews.length).toBe(2);

    const tenant1 = overviews.find((t) => t.sellerId === "SELLER_1");
    expect(tenant1?.tokenHealth).toBe("healthy");
    expect(tenant1?.totalQuestions).toBe(45);

    const tenant2 = overviews.find((t) => t.sellerId === "SELLER_2");
    expect(tenant2?.tokenHealth).toBe("expiring_soon");
  });

  it("debe permitir activar o pausar el auto-responder de una tienda", async () => {
    const useCase = new ToggleTenantAutoAnswerUseCase(mockTenantRepo, mockEventRepo);
    const result = await useCase.execute({ sellerId: "SELLER_1", enabled: false });

    expect(result.sellerId).toBe("SELLER_1");
    expect(result.autoAnswerEnabled).toBe(false);
    expect(mockTenantRepo.save).toHaveBeenCalled();
    expect(mockEventRepo.log).toHaveBeenCalled();
  });
});
