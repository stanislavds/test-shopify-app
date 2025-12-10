#!/usr/bin/env node
/**
 * Script to test database connection
 * Usage: node scripts/test-db-connection.js
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log("\n🔌 Testing Database Connection\n");
    console.log("=".repeat(50));

    if (!process.env.DATABASE_URL) {
      console.error("\n❌ ERROR: DATABASE_URL environment variable is not set!");
      console.log("\n💡 To fix this:");
      console.log("   1. Create a .env file in your project root");
      console.log("   2. Add: DATABASE_URL=\"postgresql://user:password@host:port/database\"");
      console.log("   3. Or set it in your hosting platform's environment variables\n");
      process.exit(1);
    }

    // Mask the password in the connection string for display
    const maskedUrl = process.env.DATABASE_URL.replace(
      /:\/\/[^:]+:[^@]+@/,
      "://***:***@"
    );
    console.log(`\n📡 Connection String: ${maskedUrl}\n`);

    // Test connection
    console.log("Testing connection...");
    await prisma.$connect();
    console.log("✅ Successfully connected to database!\n");

    // Test query
    console.log("Testing query...");
    const sessionCount = await prisma.session.count();
    const shopCount = await prisma.shop.count();
    console.log(`✅ Query successful!`);
    console.log(`   Sessions: ${sessionCount}`);
    console.log(`   Shops: ${shopCount}\n`);

    // Check if tables exist
    console.log("Checking database schema...");
    try {
      await prisma.$queryRaw`SELECT 1 FROM "Session" LIMIT 1`;
      await prisma.$queryRaw`SELECT 1 FROM "Shop" LIMIT 1`;
      console.log("✅ All required tables exist (Session, Shop)\n");
    } catch (error) {
      console.log("⚠️  Warning: Some tables may be missing");
      console.log("   Run migrations: npm run setup\n");
    }

    console.log("=".repeat(50));
    console.log("\n✨ Database connection test passed!\n");
  } catch (error) {
    console.error("\n❌ Database connection failed!");
    console.error(`   Error: ${error.message}\n`);
    
    if (error.message.includes("P1001")) {
      console.log("💡 This usually means:");
      console.log("   - The database server is not reachable");
      console.log("   - The host/port is incorrect");
      console.log("   - Your IP is not whitelisted");
      console.log("   - Firewall is blocking the connection\n");
    } else if (error.message.includes("P1000")) {
      console.log("💡 This usually means:");
      console.log("   - Authentication failed (wrong username/password)");
      console.log("   - The database doesn't exist");
      console.log("   - SSL connection is required (add ?sslmode=require)\n");
    } else if (error.message.includes("does not exist")) {
      console.log("💡 This usually means:");
      console.log("   - Tables haven't been created yet");
      console.log("   - Run migrations: npm run setup\n");
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();

