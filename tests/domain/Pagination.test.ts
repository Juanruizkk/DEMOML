import { describe, it, expect } from "vitest";
import { paginateArray } from "../../src/domain/value-objects/Pagination.js";

describe("paginateArray", () => {
  const items = Array.from({ length: 45 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));

  it("calcula paginación para la primera página por defecto", () => {
    const result = paginateArray(items, 1, 20);

    expect(result.data.length).toBe(20);
    expect(result.data[0].id).toBe(1);
    expect(result.data[19].id).toBe(20);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 45,
      totalPages: 3,
      hasNext: true,
      hasPrev: false,
    });
  });

  it("calcula paginación para la página intermedia", () => {
    const result = paginateArray(items, 2, 20);

    expect(result.data.length).toBe(20);
    expect(result.data[0].id).toBe(21);
    expect(result.data[19].id).toBe(40);
    expect(result.pagination).toEqual({
      page: 2,
      limit: 20,
      total: 45,
      totalPages: 3,
      hasNext: true,
      hasPrev: true,
    });
  });

  it("calcula paginación para la última página", () => {
    const result = paginateArray(items, 3, 20);

    expect(result.data.length).toBe(5);
    expect(result.data[0].id).toBe(41);
    expect(result.data[4].id).toBe(45);
    expect(result.pagination).toEqual({
      page: 3,
      limit: 20,
      total: 45,
      totalPages: 3,
      hasNext: false,
      hasPrev: true,
    });
  });

  it("maneja array vacío correctamente", () => {
    const result = paginateArray([], 1, 10);

    expect(result.data).toEqual([]);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });
  });

  it("ajusta parámetros inválidos o negativos a valores por defecto", () => {
    const result = paginateArray(items, -5, 0);

    expect(result.pagination.page).toBe(1);
    expect(result.pagination.limit).toBe(20);
    expect(result.data.length).toBe(20);
  });
});
