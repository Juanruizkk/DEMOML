import "dotenv/config";
import { db } from "../src/infrastructure/persistence/drizzle/db.js";
import { tenants } from "../src/infrastructure/persistence/drizzle/schema.js";
import { PLAN_LIMITS } from "../src/domain/entities/Tenant.js";
import { eq } from "drizzle-orm";

async function main() {
  const list = await db.select().from(tenants);
  console.log(`Found ${list.length} tenants in DB. Repairing settings JSON...`);

  for (const t of list) {
    const raw = JSON.parse(t.settingsJson || "{}");
    const planId = raw.planId || "starter";
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const updatedSettings = {
      ...raw,
      planId,
      billingStatus: raw.billingStatus || "active",
      monthlyLLMLimit: raw.monthlyLLMLimit || PLAN_LIMITS[planId]?.llmResponsesPerMonth || 300,
      llmResponsesThisMonth: raw.llmResponsesThisMonth || 0,
      llmQuotaExhaustedAt: raw.llmQuotaExhaustedAt || null,
      cycleResetDate: raw.cycleResetDate || nextMonth.toISOString(),
      nextBillingDate: raw.nextBillingDate || nextMonth.toISOString(),
    };

    await db.update(tenants)
      .set({
        settingsJson: JSON.stringify(updatedSettings),
        billingStatus: updatedSettings.billingStatus,
        nextBillingDate: new Date(updatedSettings.nextBillingDate),
        updatedAt: new Date()
      })
      .where(eq(tenants.id, t.id));

    console.log(`✅ Tenant ${t.sellerId} (${t.nickname}) settings updated successfully.`);
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
