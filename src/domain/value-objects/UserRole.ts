export type UserRoleType = "super_admin" | "tenant" | "demo";

export const USER_ROLES = {
  SUPER_ADMIN: "super_admin",
  TENANT: "tenant",
  DEMO: "demo",
} as const;
