import { describe, it, expect } from "vitest";
import { AnalyzeItemQualityUseCase } from "../../src/application/use-cases/products/AnalyzeItemQualityUseCase.js";
import { Item } from "../../src/domain/entities/Item.js";

function makeItem(overrides: Partial<ConstructorParameters<typeof Item>[0]> = {}): Item {
  return new Item({
    id: "MLA123",
    sellerId: "seller-1",
    title: "Teclado Gamer Samsung Galaxy S24",
    price: 10000,
    currencyId: "ARS",
    availableQuantity: 5,
    condition: "new",
    attributes: [
      { name: "Marca", value_name: "Samsung" },
      { name: "Modelo", value_name: "Galaxy S24" },
    ],
    descriptionText: "Este es un teclado gamer de alta calidad con switches mecánicos y retroiluminación RGB. Ideal para gaming competitivo.",
    pictures: ["url1", "url2", "url3", "url4"],
    videoId: "vid123",
    freeShipping: true,
    ...overrides,
  });
}

describe("AnalyzeItemQualityUseCase", () => {
  const useCase = new AnalyzeItemQualityUseCase();

  describe("title_brand check", () => {
    it("ok when brand attribute value appears in title", () => {
      const item = makeItem();
      const checks = useCase.execute(item);
      const check = checks.find((c) => c.key === "title_brand")!;
      expect(check.status).toBe("ok");
      expect(check.detail).toContain("Samsung");
    });

    it("error when brand attribute exists but value not in title", () => {
      const item = makeItem({ title: "Teclado Gamer sin marca" });
      const checks = useCase.execute(item);
      const check = checks.find((c) => c.key === "title_brand")!;
      expect(check.status).toBe("error");
      expect(check.suggestion).toBeDefined();
    });

    it("error when brand attribute is missing", () => {
      const item = makeItem({ attributes: [{ name: "Modelo", value_name: "Galaxy S24" }] });
      const checks = useCase.execute(item);
      const check = checks.find((c) => c.key === "title_brand")!;
      expect(check.status).toBe("error");
    });
  });

  describe("title_model check", () => {
    it("ok when model attribute value appears in title", () => {
      const item = makeItem();
      const checks = useCase.execute(item);
      const check = checks.find((c) => c.key === "title_model")!;
      expect(check.status).toBe("ok");
    });

    it("error when model attribute exists but value not in title", () => {
      const item = makeItem({ title: "Teclado Gamer Samsung sin modelo" });
      const checks = useCase.execute(item);
      const check = checks.find((c) => c.key === "title_model")!;
      expect(check.status).toBe("error");
      expect(check.suggestion).toBeDefined();
    });

    it("error when model attribute is missing", () => {
      const item = makeItem({ attributes: [{ name: "Marca", value_name: "Samsung" }] });
      const checks = useCase.execute(item);
      const check = checks.find((c) => c.key === "title_model")!;
      expect(check.status).toBe("error");
    });
  });

  describe("images check", () => {
    it("ok when 4 or more pictures", () => {
      const item = makeItem({ pictures: ["a", "b", "c", "d"] });
      const check = useCase.execute(item).find((c) => c.key === "images")!;
      expect(check.status).toBe("ok");
      expect(check.detail).toBe("4 imágenes");
    });

    it("warning when 1-3 pictures", () => {
      const item = makeItem({ pictures: ["a", "b"] });
      const check = useCase.execute(item).find((c) => c.key === "images")!;
      expect(check.status).toBe("warning");
      expect(check.suggestion).toBeDefined();
    });

    it("error when no pictures", () => {
      const item = makeItem({ pictures: [] });
      const check = useCase.execute(item).find((c) => c.key === "images")!;
      expect(check.status).toBe("error");
    });
  });

  describe("video check", () => {
    it("ok when videoId is set", () => {
      const item = makeItem({ videoId: "vid123" });
      const check = useCase.execute(item).find((c) => c.key === "video")!;
      expect(check.status).toBe("ok");
    });

    it("warning when videoId is null", () => {
      const item = makeItem({ videoId: null });
      const check = useCase.execute(item).find((c) => c.key === "video")!;
      expect(check.status).toBe("warning");
      expect(check.suggestion).toBeDefined();
    });
  });

  describe("description check", () => {
    it("ok when description longer than 100 chars", () => {
      const item = makeItem({ descriptionText: "a".repeat(101) });
      const check = useCase.execute(item).find((c) => c.key === "description")!;
      expect(check.status).toBe("ok");
    });

    it("warning when description is 1-100 chars", () => {
      const item = makeItem({ descriptionText: "Corto" });
      const check = useCase.execute(item).find((c) => c.key === "description")!;
      expect(check.status).toBe("warning");
    });

    it("error when description is empty", () => {
      const item = makeItem({ descriptionText: "" });
      const check = useCase.execute(item).find((c) => c.key === "description")!;
      expect(check.status).toBe("error");
    });
  });

  describe("free_shipping check", () => {
    it("ok when freeShipping is true", () => {
      const item = makeItem({ freeShipping: true });
      const check = useCase.execute(item).find((c) => c.key === "free_shipping")!;
      expect(check.status).toBe("ok");
    });

    it("warning when freeShipping is false", () => {
      const item = makeItem({ freeShipping: false });
      const check = useCase.execute(item).find((c) => c.key === "free_shipping")!;
      expect(check.status).toBe("warning");
      expect(check.suggestion).toBeDefined();
    });
  });

  describe("stock check", () => {
    it("ok when stock > 0", () => {
      const item = makeItem({ availableQuantity: 3 });
      const check = useCase.execute(item).find((c) => c.key === "stock")!;
      expect(check.status).toBe("ok");
      expect(check.detail).toBe("3 unidades");
    });

    it("error when stock is 0", () => {
      const item = makeItem({ availableQuantity: 0 });
      const check = useCase.execute(item).find((c) => c.key === "stock")!;
      expect(check.status).toBe("error");
    });
  });

  it("returns exactly 7 checks in fixed order", () => {
    const item = makeItem();
    const checks = useCase.execute(item);
    expect(checks).toHaveLength(7);
    expect(checks.map((c) => c.key)).toEqual([
      "title_brand",
      "title_model",
      "images",
      "video",
      "description",
      "free_shipping",
      "stock",
    ]);
  });
});
