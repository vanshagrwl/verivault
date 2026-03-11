#!/usr/bin/env node
/**
 * Direct database clearing script
 * Clears all certificates from MongoDB
 * Usage: npx tsx clear-db.js
 */

import "dotenv/config";
import { MongoClient } from "mongodb";

async function clearDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error("❌ MONGODB_URI not found in environment variables");
      process.exit(1);
    }

    console.log("🔌 Connecting to MongoDB...");
    const client = new MongoClient(mongoUri);
    await client.connect();
    console.log("✅ Connected to MongoDB");

    const db = client.db("VeriVault");
    const certificatesCollection = db.collection("certificates");

    console.log("🗑️  Deleting all certificates...");
    const result = await certificatesCollection.deleteMany({});

    console.log(`✅ Successfully deleted ${result.deletedCount} certificates`);

    // List remaining collections for verification
    const collections = await db.listCollections().toArray();
    console.log("\n📊 Remaining collections:", collections.map((c) => c.name));

    await client.close();
    console.log("✅ Database clearing complete");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error clearing database:", error);
    process.exit(1);
  }
}

clearDatabase();
