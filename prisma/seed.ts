import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // Upsert plans so this is idempotent
  await db.plan.upsert({
    where: { slug: "free" },
    create: {
      name: "חינמי",
      slug: "free",
      priceMonthly: 0,
      maxConversationsPerMonth: 10,
      maxAudioMinutesPerMonth: 120,
      maxAiQueriesPerMonth: 50,
      maxStorageMb: 500,
      maxMembersPerWorkspace: 3,
      isActive: false, // not selectable; free tier is used implicitly
    },
    update: {},
  });

  await db.plan.upsert({
    where: { slug: "pro" },
    create: {
      name: "Pro",
      slug: "pro",
      priceMonthly: 49,
      maxConversationsPerMonth: 200,
      maxAudioMinutesPerMonth: 3000,
      maxAiQueriesPerMonth: 1000,
      maxStorageMb: 10000,
      maxMembersPerWorkspace: 20,
      isActive: true,
    },
    update: {
      priceMonthly: 49,
      maxConversationsPerMonth: 200,
      maxAudioMinutesPerMonth: 3000,
      maxAiQueriesPerMonth: 1000,
      maxStorageMb: 10000,
      maxMembersPerWorkspace: 20,
    },
  });

  console.log("✓ Plans seeded");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
