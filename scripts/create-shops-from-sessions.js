#!/usr/bin/env node
/**
 * Script to create Shop records from existing Session records
 * This fixes the issue where sessions exist but shop records don't
 * Usage: node scripts/create-shops-from-sessions.js
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function createShopsFromSessions() {
  try {
    console.log("\n🔧 Creating Shop records from Sessions\n");
    console.log("=".repeat(50));

    // Get all unique shops from sessions
    const sessions = await prisma.session.findMany({
      select: {
        shop: true,
        accessToken: true,
        scope: true,
      },
      distinct: ["shop"],
    });

    if (sessions.length === 0) {
      console.log("\n⚠️  No sessions found. Nothing to do.");
      return;
    }

    console.log(`\nFound ${sessions.length} unique shop(s) in sessions\n`);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const session of sessions) {
      // Check if shop record already exists
      const existingShop = await prisma.shop.findUnique({
        where: { shop: session.shop },
      });

      if (existingShop) {
        console.log(`⏭️  Shop record already exists: ${session.shop}`);
        skipped++;
        continue;
      }

      // Get the most recent session for this shop to get the latest access token
      const latestSession = await prisma.session.findFirst({
        where: { shop: session.shop },
        orderBy: { id: "desc" },
        select: {
          accessToken: true,
          scope: true,
        },
      });

      // Create shop record
      await prisma.shop.create({
        data: {
          shop: session.shop,
          domain: session.shop,
          accessToken: latestSession?.accessToken || session.accessToken,
          scope: latestSession?.scope || session.scope || null,
          isActive: true,
          installedAt: new Date(),
        },
      });

      console.log(`✅ Created shop record: ${session.shop}`);
      created++;
    }

    console.log("\n" + "=".repeat(50));
    console.log(`\n📊 Summary:`);
    console.log(`   Created: ${created}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log("\n✅ Done!\n");
  } catch (error) {
    console.error("❌ Error creating shop records:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createShopsFromSessions();

