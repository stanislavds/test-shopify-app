#!/usr/bin/env node
/**
 * Script to check database contents
 * Usage: node scripts/check-db.js
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log("\n📊 Database Status\n");
    console.log("=" .repeat(50));

    // Count records
    const sessionCount = await prisma.session.count();
    const shopCount = await prisma.shop.count();

    console.log(`\n📦 Sessions: ${sessionCount}`);
    console.log(`🏪 Shops: ${shopCount}\n`);

    // Show recent sessions
    if (sessionCount > 0) {
      console.log("Recent Sessions:");
      console.log("-".repeat(50));
      const sessions = await prisma.session.findMany({
        take: 5,
        orderBy: { id: "desc" },
        select: {
          id: true,
          shop: true,
          isOnline: true,
          scope: true,
          accountOwner: true,
          email: true,
        },
      });

      sessions.forEach((session, index) => {
        console.log(`\n${index + 1}. Session ID: ${session.id}`);
        console.log(`   Shop: ${session.shop}`);
        console.log(`   Online: ${session.isOnline}`);
        console.log(`   Scope: ${session.scope || "N/A"}`);
        console.log(`   Account Owner: ${session.accountOwner}`);
        console.log(`   Email: ${session.email || "N/A"}`);
      });
    }

    // Check for missing shops (even if some shops exist)
    const uniqueShops = sessionCount > 0 ? await prisma.session.findMany({
      select: { shop: true },
      distinct: ["shop"],
    }) : [];
    
    const existingShopRecords = await prisma.shop.findMany({
      select: { shop: true },
    });
    const existingShopNames = new Set(existingShopRecords.map(s => s.shop));
    const missingShops = uniqueShops
      .map(s => s.shop)
      .filter(shop => !existingShopNames.has(shop));

    // Auto-create missing shop records
    if (missingShops.length > 0) {
      console.log("\n⚠️  Found sessions without Shop records!");
      console.log("-".repeat(50));
      console.log(`Shops missing records: ${missingShops.join(", ")}`);
      console.log("\n🔧 Automatically creating missing Shop records...\n");
      
      let created = 0;
      for (const shopName of missingShops) {
        // Get the most recent session for this shop to get the latest access token
        const latestSession = await prisma.session.findFirst({
          where: { shop: shopName },
          orderBy: { id: "desc" },
          select: {
            accessToken: true,
            scope: true,
          },
        });

        // Create shop record
        await prisma.shop.create({
          data: {
            shop: shopName,
            domain: shopName,
            accessToken: latestSession?.accessToken || null,
            scope: latestSession?.scope || null,
            isActive: true,
            installedAt: new Date(),
          },
        });

        console.log(`   ✅ Created shop record: ${shopName}`);
        created++;
      }
      
      console.log(`\n✨ Created ${created} shop record(s).\n`);
    }

    // Show shops
    const finalShopCount = await prisma.shop.count();
    if (finalShopCount > 0) {
      console.log("\nShops:");
      console.log("-".repeat(50));
      const shops = await prisma.shop.findMany({
        orderBy: { installedAt: "desc" },
        select: {
          id: true,
          shop: true,
          isActive: true,
          installedAt: true,
          uninstalledAt: true,
          scope: true,
        },
      });

      shops.forEach((shop, index) => {
        console.log(`\n${index + 1}. Shop: ${shop.shop}`);
        console.log(`   ID: ${shop.id}`);
        console.log(`   Active: ${shop.isActive}`);
        console.log(`   Installed: ${shop.installedAt}`);
        console.log(`   Uninstalled: ${shop.uninstalledAt || "N/A"}`);
        console.log(`   Scope: ${shop.scope || "N/A"}`);
      });
    } else {
      console.log("\n⚠️  No shops found. The afterAuth hook will create a shop record when you authenticate.");
    }

    console.log("\n" + "=".repeat(50) + "\n");
  } catch (error) {
    console.error("❌ Error checking database:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();

