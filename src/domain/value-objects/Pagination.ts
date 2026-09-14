export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMetadata;
}

export function paginateArray<T>(
  items: T[],
  page: number = 1,
  limit: number = 20
): PaginatedResult<T> {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const total = items.length;
  const totalPages = Math.ceil(total / safeLimit) || 1;
  const offset = (safePage - 1) * safeLimit;
  const data = items.slice(offset, offset + safeLimit);

  return {
    data,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages,
      hasNext: safePage < totalPages,
      hasPrev: safePage > 1,
    },
  };
}
