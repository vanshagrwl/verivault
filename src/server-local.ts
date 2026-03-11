// Local development server using Hono's Node.js adapter
// Run this with: npx tsx src/server-local.ts
import "dotenv/config";
import { serve } from "@hono/node-server";
import app from "./worker/index";
import { connectToDatabase, getCollection, closeConnection } from "./lib/mongodb";
import { createAdmin, findAdminByEmail } from "./lib/auth";
import type { Admin, User } from "./lib/models";

const port = Number(process.env.PORT || 8787);

// Initialize MongoDB: migrate old admins to admins collection, create default admin if needed
async function initializeDatabase() {
  try {
    try {
      await connectToDatabase();
      console.log("MongoDB connected successfully");
    } catch (err: any) {
      if ((process.env.NODE_ENV || "").toLowerCase() === "production") {
        throw err;
      }
      console.warn("MongoDB connection failed, starting in-memory MongoDB for local dev...");
      await closeConnection();
      const { MongoMemoryServer } = await import("mongodb-memory-server");
      const mem = await MongoMemoryServer.create({
        instance: { dbName: process.env.DB_NAME || "verivault" },
      });
      process.env.MONGODB_URI = mem.getUri();
      await connectToDatabase();
      console.log(`✓ In-memory MongoDB started: ${process.env.MONGODB_URI}`);
    }

    // Ensure indexes
    const usersUnique = await (await getCollection<User & { role?: string }>("users")).createIndex(
      { email: 1 },
      { unique: true, name: "users_email_unique" }
    );
    const adminsUnique = await (await getCollection<Admin>("admins")).createIndex(
      { email: 1 },
      { unique: true, name: "admins_email_unique" }
    );
    await (await getCollection<any>("certificates")).createIndex(
      { id: 1 },
      { unique: true, name: "certificates_id_unique" }
    );
    await (await getCollection<any>("sessions")).createIndex(
      { tokenHash: 1, type: 1 },
      { unique: true, name: "sessions_tokenhash_type_unique" }
    );
    await (await getCollection<any>("sessions")).createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, name: "sessions_expires_ttl" }
    );

    // Migration: move any admins from users collection to admins collection
    const usersCollection = await getCollection<User & { role?: string }>("users");
    const adminsCollection = await getCollection<Admin>("admins");
    const oldAdmins = await usersCollection.find({ role: "admin" }).toArray();
    for (const u of oldAdmins) {
      const existing = await findAdminByEmail(u.email);
      if (!existing) {
        await adminsCollection.insertOne({
          email: u.email,
          password: u.password, // already hashed
          name: u.name,
          createdAt: u.createdAt || new Date(),
          updatedAt: new Date(),
        });
        await usersCollection.deleteOne({ email: u.email });
        console.log(`✓ Migrated admin to admins collection: ${u.email}`);
      }
    }

    // Migration: convert old long certificate IDs to new short format (CERT-XXXXXX)
    const certificatesCollection = await getCollection<any>("certificates");
    const oldCerts = await certificatesCollection.find({ id: /^CERT-\d+-/ }).toArray();
    
    if (oldCerts.length > 0) {
      console.log(`\n📋 Migrating ${oldCerts.length} certificate(s) to new ID format...`);
      
      // Helper to generate unique short ID
      async function generateNewCertId(): Promise<string> {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        while (true) {
          let result = 'CERT-';
          for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          const existing = await certificatesCollection.findOne({ id: result });
          if (!existing) {
            return result;
          }
        }
      }
      
      for (const cert of oldCerts) {
        const newId = await generateNewCertId();
        await certificatesCollection.updateOne(
          { _id: cert._id },
          { $set: { id: newId, updatedAt: new Date() } }
        );
        console.log(`  ✓ ${cert.id} → ${newId} (${cert.name})`);
      }
      console.log(`✓ Certificate ID migration complete\n`);
    }

    const adminEmail = (process.env.ADMIN_EMAIL || "admin@verivault.com").toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

    const existingAdmin = await findAdminByEmail(adminEmail);
    if (!existingAdmin) {
      await createAdmin(adminEmail, adminPassword, "Admin");
      console.log(`✓ Default admin created (admins collection):`);
      console.log(`  Email: ${adminEmail}`);
      console.log(`  Password: ${adminPassword}`);
    } else {
      console.log(`✓ Admin already exists: ${adminEmail}`);
    }
  } catch (error) {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  }
}

// Initialize database before starting server
initializeDatabase().then(() => {
  console.log(`Server is running on port ${port}`);
  
  serve({
    fetch: app.fetch,
    port,
    env: {} as any,
  });
});
