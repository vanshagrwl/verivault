import "dotenv/config";
import { serve } from "@hono/node-server";
import app from "./worker/index";
import { connectToDatabase, getCollection } from "./lib/mongodb";
import { createAdmin, findAdminByEmail } from "./lib/auth";
import type { Admin, User } from "./lib/models";

const port = Number(process.env.PORT || 8787);

async function initializeDatabase() {
  await connectToDatabase();

  // Ensure indexes
  await (await getCollection<User & { role?: string }>("users")).createIndex(
    { email: 1 },
    { unique: true, name: "users_email_unique" }
  );
  await (await getCollection<Admin>("admins")).createIndex(
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
    console.log(`✓ Default admin created: ${adminEmail}`);
  } else {
    console.log(`✓ Admin already exists: ${adminEmail}`);
  }
}

initializeDatabase()
  .then(() => {
    console.log(`Server is running on port ${port}`);
    serve({ fetch: app.fetch, port, env: {} as any });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });

