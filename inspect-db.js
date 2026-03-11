#!/usr/bin/env node
/**
 * Database inspection script
 * Shows all collections and counts documents
 */

import "dotenv/config";
import { MongoClient } from "mongodb";

async function inspectDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    console.log("🔌 Connecting to MongoDB...");
    console.log("📍 URI:", mongoUri);

    const client = new MongoClient(mongoUri);
    await client.connect();
    console.log("✅ Connected\n");

    const db = client.db("VeriVault");

    // List all collections
    const collections = await db.listCollections().toArray();
    console.log(`📊 Database collections (${collections.length}):`);
    collections.forEach((c) => {
      console.log(`  - ${c.name}`);
    });

    if (collections.length === 0) {
      console.log("\n⚠️  No collections found!");
    } else {
      console.log("\n📈 Document counts:");
      for (const collection of collections) {
        const count = await db.collection(collection.name).countDocuments();
        console.log(`  ${collection.name}: ${count} documents`);

        if (collection.name === "certificates" && count > 0) {
          console.log("\n📋 Sample certificates:");
          const sample = await db.collection("certificates").find({}).limit(3).toArray();
          sample.forEach((doc, idx) => {
            console.log(`  [${idx + 1}] ID: ${doc.id}, Name: ${doc.name}, Email: ${doc.ownerEmail}`);
          });
        }
      }
    }

    await client.close();
    console.log("\n✅ Inspection complete");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

inspectDatabase();
