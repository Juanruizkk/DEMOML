import "dotenv/config";
import { db } from "../src/infrastructure/persistence/drizzle/db.js";
import { tenants, questions, events } from "../src/infrastructure/persistence/drizzle/schema.js";

async function main() {
  const tenantList = await db.select().from(tenants);
  const tenant = tenantList[0];
  console.log(`Tenant: ${tenant.sellerId} (${tenant.nickname || tenant.email})`);

  // 1. Check questions in DB
  const dbQuestions = await db.select().from(questions);
  console.log("\n--- Preguntas en la Base de Datos ---");
  console.log(`Total preguntas en DB: ${dbQuestions.length}`);
  for (const q of dbQuestions) {
    console.log(`- [${q.questionId}] status: ${q.appStatus} | text: "${q.text}" | answer: "${q.finalAnswer || q.suggestedAnswer}"`);
  }

  // 2. Check events in DB
  const dbEvents = await db.select().from(events);
  console.log("\n--- Últimos 5 Eventos ---");
  console.log(`Total eventos: ${dbEvents.length}`);
  for (const ev of dbEvents.slice(-5)) {
    console.log(`- [${ev.type}] ${ev.message} (${ev.createdAt})`);
  }

  // 3. Query Mercado Libre directly for unanswered questions
  console.log("\n--- Consultando API de Mercado Libre directamente ---");
  const res = await fetch(`https://api.mercadolibre.com/questions/search?seller_id=${tenant.sellerId}&status=UNANSWERED`, {
    headers: { Authorization: `Bearer ${tenant.accessToken}` }
  });
  const data = await res.json();
  console.log("MELI UNANSWERED questions response:", JSON.stringify(data, null, 2));

  // Also query all questions (ANSWERED + UNANSWERED)
  const allRes = await fetch(`https://api.mercadolibre.com/questions/search?seller_id=${tenant.sellerId}`, {
    headers: { Authorization: `Bearer ${tenant.accessToken}` }
  });
  const allData = await allRes.json();
  console.log("MELI ALL questions total:", allData.total);
  if (allData.questions && allData.questions.length > 0) {
    console.log("MELI ALL questions:", JSON.stringify(allData.questions, null, 2));
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
