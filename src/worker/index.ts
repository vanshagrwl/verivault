import { Hono } from "hono";
import { cors } from "hono/cors";
import { zValidator } from "@hono/zod-validator";
import z from "zod";
import { LoginSchema, CertificateCreateSchema } from "../shared/types";
import { getCollection, connectToDatabase } from "../lib/mongodb";
import { verifyUser, createUser, findUserByEmail, verifyAdmin, createAdmin, findAdminByEmail } from "../lib/auth";
import type { User, Admin, Certificate, Student, SessionDoc } from "../lib/models";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { generateOTP, createOTPVerification, verifyOTPRecord, sendOTPEmail } from "../lib/otp";

// Generate professional certificate ID (format: CERT-ABC123)
async function generateCertificateId(): Promise<string> {
  const certificatesCollection = await getCollection<Certificate>("certificates");

  while (true) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'CERT-';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Check if this ID already exists
    const existing = await certificatesCollection.findOne({ id: result });
    if (!existing) {
      return result;
    }
  }
}

interface Env {
  MONGODB_URI?: string;
  CORS_ORIGIN?: string;
}

type Variables = {
  authType?: "user" | "admin";
  user?: User;
  admin?: Admin;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Initialize database indexes for better performance (reduces memory usage and improves query speed)
async function initializeIndexes() {
  try {
    const certificatesCollection = await getCollection<Certificate>("certificates");
    const usersCollection = await getCollection<User>("users");
    const sessionsCollection = await getCollection<SessionDoc>("sessions");
    const otpCollection = await getCollection("otps");
    
    // Certificate indexes
    await certificatesCollection.createIndex({ id: 1 }, { unique: true });
    await certificatesCollection.createIndex({ ownerEmail: 1 });
    await certificatesCollection.createIndex({ claimedAt: 1 });
    await certificatesCollection.createIndex({ verifiedAt: 1 });
    await certificatesCollection.createIndex({ createdAt: 1 });
    
    // User indexes
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    await usersCollection.createIndex({ createdAt: 1 });
    
    // Session indexes
    await sessionsCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
    await sessionsCollection.createIndex({ email: 1 });
    
    // OTP indexes
    await otpCollection.createIndex({ certificateId: 1 });
    await otpCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
    
    console.log("Database indexes initialized successfully");
  } catch (error) {
    console.log("Indexes may already exist or initialization skipped:", error);
  }
}

initializeIndexes().catch(err => console.log("Index initialization error:", err));

// Enable CORS for local development
app.use("*", cors({
  origin: (origin) => {
    const allowed = (process.env.CORS_ORIGIN || "http://localhost:5173").toLowerCase();
    if (!origin) return allowed;
    return origin.toLowerCase() === allowed ? origin : allowed;
  },
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type"],
  credentials: true,
}));

type SessionType = "user" | "admin";

// Database cache for better memory efficiency
const dbCache = {
  certificates: new Map<string, any>(), // Cache by certificate ID
  users: new Map<string, any>(), // Cache by email
  maxSize: 1000,
  ttl: 5 * 60 * 1000, // 5 minutes
  
  get<T>(collection: string, key: string): T | null {
    const map = this[collection as keyof typeof this];
    if (!(map instanceof Map)) return null;
    const entry = map.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttl) {
      map.delete(key);
      return null;
    }
    return entry.value;
  },
  
  set<T>(collection: string, key: string, value: T): void {
    const map = this[collection as keyof typeof this];
    if (!(map instanceof Map)) return;
    if (map.size >= this.maxSize) {
      // Remove oldest entry
      const firstKey = map.keys().next().value;
      if (firstKey) map.delete(firstKey);
    }
    map.set(key, { value, timestamp: Date.now() });
  },
  
  invalidate(collection: string, key?: string): void {
    if (!key) {
      const map = this[collection as keyof typeof this];
      if (map instanceof Map) map.clear();
      return;
    }
    const map = this[collection as keyof typeof this];
    if (map instanceof Map) map.delete(key);
  }
};

const SESSION_COOKIE = "vv_session";
const SESSION_TYPE_COOKIE = "vv_session_type";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

// Basic in-memory rate limiter (good for local/dev; use KV/Redis in production)
type RateState = { count: number; resetAt: number };
const rateMap = new Map<string, RateState>();
function getClientIp(c: any): string {
  const xf = c.req.header("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  return c.req.header("x-real-ip") || "local";
}
function rateLimit(max: number, windowMs: number) {
  return async (c: any, next: any) => {
    const ip = getClientIp(c);
    const key = `${ip}::${c.req.path}`;
    const now = Date.now();
    const cur = rateMap.get(key);
    if (!cur || cur.resetAt <= now) {
      rateMap.set(key, { count: 1, resetAt: now + windowMs });
      await next();
      return;
    }
    if (cur.count >= max) {
      const retryAfter = Math.max(1, Math.ceil((cur.resetAt - now) / 1000));
      c.header("Retry-After", String(retryAfter));
      return c.json({ success: false, error: "Too many requests. Please try again later." }, 429);
    }
    cur.count += 1;
    rateMap.set(key, cur);
    await next();
  };
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function createSession(c: any, type: SessionType, email: string) {
  const raw = crypto.randomUUID();
  const tokenHash = await sha256Hex(raw);
  const sessions = await getCollection<SessionDoc>("sessions");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
  await sessions.insertOne({ tokenHash, type, email: email.toLowerCase(), createdAt: now, expiresAt });

  // cookies need to be sent across domains (Vercel frontend -> Render backend).
  // Use SameSite=None and secure=true for cross-site requests.
  const cookieOpts = {
    httpOnly: true,
    sameSite: "None" as const,   // allow cross-site transmission
    secure: true,                 // always secure (cookies only on HTTPS)
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
  setCookie(c, SESSION_COOKIE, raw, cookieOpts);
  setCookie(c, SESSION_TYPE_COOKIE, type, { ...cookieOpts, httpOnly: false });
}

async function clearSession(c: any) {
  const raw = getCookie(c, SESSION_COOKIE);
  if (raw) {
    const tokenHash = await sha256Hex(raw);
    const sessions = await getCollection<SessionDoc>("sessions");
    await sessions.deleteOne({ tokenHash });
  }
  // when deleting, match the same opts so the cookie is actually removed
  deleteCookie(c, SESSION_COOKIE, { path: "/", sameSite: "None", secure: true });
  deleteCookie(c, SESSION_TYPE_COOKIE, { path: "/", sameSite: "None", secure: true });
}

// Auth middleware (cookie-session based)
const authMiddleware = async (c: any, next: any) => {
  try {
    const raw = getCookie(c, SESSION_COOKIE);
    const type = getCookie(c, SESSION_TYPE_COOKIE) as SessionType | undefined;
    if (!raw || (type !== "user" && type !== "admin")) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const tokenHash = await sha256Hex(raw);
    const sessions = await getCollection<SessionDoc>("sessions");
    const session = await sessions.findOne({ tokenHash, type });
    if (!session) return c.json({ success: false, error: "Unauthorized" }, 401);
    if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
      await sessions.deleteOne({ tokenHash });
      return c.json({ success: false, error: "Session expired" }, 401);
    }

    if (type === "admin") {
      const admin = await findAdminByEmail(session.email);
      if (!admin) return c.json({ success: false, error: "Unauthorized" }, 401);
      c.set("admin", admin);
      c.set("authType", "admin");
    } else {
      const user = await findUserByEmail(session.email);
      if (!user) return c.json({ success: false, error: "Unauthorized" }, 401);
      c.set("user", user);
      c.set("authType", "user");
    }

    await next();
  } catch (error: any) {
    return c.json({ success: false, error: "Authentication failed" }, 401);
  }
};

// Admin-only middleware
const adminMiddleware = async (c: any, next: any) => {
  const authType = c.get("authType");
  const admin = c.get("admin");
  if (authType !== "admin" || !admin) {
    return c.json({ success: false, error: "Admin access required" }, 403);
  }
  await next();
};

// User-only middleware (for /api/my/* routes)
const userMiddleware = async (c: any, next: any) => {
  const authType = c.get("authType");
  const user = c.get("user");
  if (authType !== "user" || !user) {
    return c.json({ success: false, error: "User access required" }, 403);
  }
  await next();
};

// Routes

// Health check
app.get("/", (c) => {
  return c.json({ success: true, message: "VeriVault API" });
});

// Detailed health check (helps verify deployed version/provider)
app.get("/api/health", (c) => {
  const version =
    process.env.RENDER_GIT_COMMIT ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT ||
    "unknown";

  // after switching providers, this should always be "resend"
  const otpEmailProvider = "resend";

  return c.json({
    success: true,
    data: {
      version,
      otpEmailProvider,
      nodeEnv: process.env.NODE_ENV || "unknown",
    },
  });
});

// Current session (works for both user and admin tokens)
app.get("/api/auth/me", authMiddleware, async (c) => {
  const authType = c.get("authType");
  if (authType === "admin") {
    const admin = c.get("admin") as Admin;
    return c.json({
      success: true,
      data: { email: admin.email, role: "admin" as const, name: admin.name },
    });
  }
  const user = c.get("user") as User;
  return c.json({
    success: true,
    data: { email: user.email, role: "user" as const, name: user.name },
  });
});

// Admin login (looks up in admins collection)
app.post("/api/auth/login/admin", rateLimit(10, 60_000), zValidator("json", LoginSchema), async (c) => {
  try {
    const { email, password } = c.req.valid("json");
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      return c.json({ success: false, error: "Email and password are required" }, 400);
    }

    const admin = await verifyAdmin(normalizedEmail, password);
    if (!admin) {
      return c.json({ success: false, error: "Invalid email or password. Please check your admin credentials and try again." }, 401);
    }
    await clearSession(c);
    await createSession(c, "admin", admin.email);

    return c.json({
      success: true,
      data: { user: { email: admin.email, role: "admin" as const } },
    });
  } catch (error: any) {
    console.error("Admin login error:", error);
    return c.json({ success: false, error: error.message || "Admin login failed. Please try again." }, 500);
  }
});

// User login (looks up in users collection) - supports email or student ID (rollNo/studentId)
app.post("/api/auth/login/user", rateLimit(10, 60_000), zValidator("json", LoginSchema), async (c) => {
  try {
    const { email, password } = c.req.valid("json");
    const identifier = email.trim();
    if (!identifier || !password) {
      return c.json({ success: false, error: "Email/Student ID and password are required" }, 400);
    }

    // Try email login first
    let user = await verifyUser(identifier.toLowerCase(), password);
    
    // If not found, try student ID login (rollNo or studentId)
    if (!user) {
      const { verifyUserByStudentId } = await import("../lib/auth");
      user = await verifyUserByStudentId(identifier, password);
    }

    if (!user) {
      return c.json({ success: false, error: "Invalid email/student ID or password" }, 401);
    }
    
    await clearSession(c);
    await createSession(c, "user", user.email);

    return c.json({
      success: true,
      data: { user: { email: user.email, role: "user" as const } },
    });
  } catch (error: any) {
    console.error("User login error:", error);
    return c.json({ success: false, error: "Login failed" }, 500);
  }
});

// Register USER account (users collection only)
app.post("/api/auth/register", rateLimit(6, 60_000), zValidator("json", z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
})), async (c) => {
  try {
    const { email, password, name } = c.req.valid("json");
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      return c.json({ success: false, error: "Email and password are required" }, 400);
    }
    if (password.length < 6) {
      return c.json({ success: false, error: "Password must be at least 6 characters long" }, 400);
    }

    const existingUser = await findUserByEmail(normalizedEmail);
    if (existingUser) {
      return c.json({ success: false, error: "An account with this email already exists" }, 400);
    }

    const user = await createUser(normalizedEmail, password, name?.trim() || undefined);
    await clearSession(c);
    await createSession(c, "user", user.email);

    return c.json({
      success: true,
      data: { user: { email: user.email, role: "user" as const } },
    }, 201);
  } catch (error: any) {
    console.error("Registration error:", error);
    return c.json({ success: false, error: error.message || "Registration failed. Please try again." }, 500);
  }
});

// Register ADMIN account (admins collection only - no invite code)
app.post("/api/auth/register/admin", rateLimit(6, 60_000), zValidator("json", z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
})), async (c) => {
  try {
    const { email, password, name } = c.req.valid("json");
    const normalizedEmail = email.trim().toLowerCase();

    const existingAdmin = await findAdminByEmail(normalizedEmail);
    if (existingAdmin) {
      return c.json({ success: false, error: "An admin account with this email already exists" }, 400);
    }

    const admin = await createAdmin(normalizedEmail, password, name?.trim() || undefined);
    await clearSession(c);
    await createSession(c, "admin", admin.email);

    return c.json({
      success: true,
      data: { user: { email: admin.email, role: "admin" as const } },
    }, 201);
  } catch (error: any) {
    return c.json({ success: false, error: error.message || "Admin registration failed" }, 500);
  }
});

app.post("/api/auth/logout", async (c) => {
  await clearSession(c);
  return c.json({ success: true });
});

// Verify certificate (public endpoint)
app.get("/api/certificates/verify/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const certificatesCollection = await getCollection<Certificate>("certificates");
    
    const cert = await certificatesCollection.findOne({ id });
    
    if (!cert) {
      return c.json({ success: false, error: "Certificate not found" }, 404);
    }
    
    // Remove MongoDB _id and convert to plain object
    const { _id, ...certData } = cert;
    
    return c.json({
      success: true,
      data: {
        ...certData,
        createdAt: cert.createdAt?.toISOString(),
        updatedAt: cert.updatedAt?.toISOString(),
        revokedAt: cert.revokedAt?.toISOString(),
        verifiedAt: cert.verifiedAt?.toISOString(),
        status: (cert.status || "issued") as any,
      },
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message || "Failed to verify certificate" }, 500);
  }
});

// User: list my certificates (requires login as user)
app.get("/api/my/certificates", authMiddleware, userMiddleware, async (c) => {
  try {
    const user = c.get("user") as User;
    const certificatesCollection = await getCollection<Certificate>("certificates");
    const certs = await certificatesCollection
      // only return certificates that the user actually claimed
      .find({ ownerEmail: user.email, claimedAt: { $exists: true } })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    return c.json({
      success: true,
      data: certs.map(({ _id, ...cert }) => ({
        ...cert,
        createdAt: cert.createdAt?.toISOString(),
        updatedAt: cert.updatedAt?.toISOString(),
        verifiedAt: cert.verifiedAt?.toISOString(),
        revokedAt: cert.revokedAt?.toISOString(),
        status: (cert.status || "issued") as any,
      })),
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message || "Failed to fetch certificates" }, 500);
  }
});

// User: claim a certificate by ID (links ownerEmail)
app.post(
  "/api/my/certificates/claim",
  authMiddleware,
  userMiddleware,
  zValidator("json", z.object({ certificateId: z.string().min(1) })),
  async (c) => {
    try {
      const { certificateId } = c.req.valid("json");
      const id = certificateId.trim().toUpperCase();
      const certificatesCollection = await getCollection<Certificate>("certificates");

      // Try cache first
      let cert = dbCache.get<Certificate>("certificates", id);
      if (!cert) {
        cert = await certificatesCollection.findOne({ id });
        if (!cert) {
          return c.json({ success: false, error: "Certificate not found" }, 404);
        }
      } else if (!cert) {
        return c.json({ success: false, error: "Certificate not found" }, 404);
      }

      // Certificate can be searched by anyone - no claiming/update until the user actually
      // verifies with OTP.  This endpoint only looks up the certificate and returns it so that
      // the client can proceed to the verification flow. We deliberately do **not** modify
      // the `claimedAt` field here; claiming only happens in `/verify-otp`.
      //
      // Even if the certificate has been claimed previously (OTP verified by somebody), we
      // still return it instead of blocking the request. The frontend may decide how to
      // present that information to the user. The `alreadyClaimed` flag tells the client
      // that the record had a `claimedAt` timestamp.

      const alreadyClaimed = !!cert.claimedAt;
      const { _id, ...certData } = cert;
      return c.json({
        success: true,
        message: "Certificate found. Proceed to verification.",
        // inform client if it was previously claimed (non‑blocking)
        alreadyClaimed,
        data: {
          ...certData,
          createdAt: cert.createdAt?.toISOString(),
          updatedAt: cert.updatedAt?.toISOString(),
          verifiedAt: cert.verifiedAt?.toISOString(),
          revokedAt: cert.revokedAt?.toISOString(),
          status: (cert.status || "issued") as any,
        },
      });
    } catch (error: any) {
      return c.json({ success: false, error: error.message || "Failed to claim certificate" }, 500);
    }
  }
);

// Get all certificates (admin only)
app.get("/api/certificates", authMiddleware, adminMiddleware, async (c) => {
  try {
    const certificatesCollection = await getCollection<Certificate>("certificates");

    const page = Math.max(1, Number(c.req.query("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") || 20)));
    const skip = (page - 1) * limit;

    const [total, certificates] = await Promise.all([
      certificatesCollection.countDocuments({}),
      certificatesCollection.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    ]);

    const items = certificates.map(({ _id, ...cert }) => ({
      ...cert,
      createdAt: cert.createdAt?.toISOString(),
      updatedAt: cert.updatedAt?.toISOString(),
      revokedAt: cert.revokedAt?.toISOString(),
      verifiedAt: cert.verifiedAt?.toISOString(),
      status: (cert.status || "issued") as any,
    }));

    return c.json({ success: true, data: { items, page, limit, total } });
  } catch (error: any) {
    return c.json({ success: false, error: error.message || "Failed to fetch certificates" }, 500);
  }
});

// Enhanced Search certificates (admin only) with advanced ranking
app.get("/api/certificates/search", authMiddleware, adminMiddleware, async (c) => {
  try {
    const query = (c.req.query("q") || "").trim().toLowerCase();
    const filterStatus = (c.req.query("status") || "all") as "all" | "issued" | "revoked";
    const limit = Math.min(parseInt(c.req.query("limit") || "100"), 200);
    
    const certificatesCollection = await getCollection<Certificate>("certificates");
    
    if (!query) {
      // Return empty array instead of no data
      return c.json({ success: true, data: [] });
    }
    
    // Get ALL certificates for flexible local filtering
    let allCerts = await certificatesCollection.find({}).limit(500).toArray();
    
    // Apply status filter
    if (filterStatus === "issued") {
      allCerts = allCerts.filter(c => c.status !== "revoked");
    } else if (filterStatus === "revoked") {
      allCerts = allCerts.filter(c => c.status === "revoked");
    }
    
    // Score and filter using local matching
    const scored = allCerts.map((cert) => {
      let score = 0;
      const queryLower = query.toLowerCase();
      const nameLower = cert.name?.toLowerCase() || "";
      const courseLower = cert.course?.toLowerCase() || "";
      const rollNoLower = cert.rollNo?.toLowerCase() || "";
      const idLower = cert.id?.toLowerCase() || "";
      
      // Exact matches (very high priority)
      if (idLower === queryLower) score += 1000;
      else if (nameLower === queryLower) score += 950;
      else if (rollNoLower === queryLower) score += 900;
      
      // Name matching (high priority)
      else if (nameLower.startsWith(queryLower)) score += 800;
      else if (nameLower.includes(` ${queryLower}`)) score += 700;
      else if (nameLower.includes(queryLower)) score += 600;
      
      // Roll number matching
      else if (rollNoLower.startsWith(queryLower)) score += 750;
      else if (rollNoLower.includes(queryLower)) score += 500;
      
      // Course matching
      else if (courseLower.startsWith(queryLower)) score += 650;
      else if (courseLower.includes(queryLower)) score += 450;
      
      // ID matching
      else if (idLower.startsWith(queryLower)) score += 700;
      else if (idLower.includes(queryLower)) score += 400;
      
      // Fuzzy: check if query chars appear in sequence (loose fuzzy)
      else {
        let fuzzyScore = 0;
        let queryIdx = 0;
        for (let i = 0; i < nameLower.length && queryIdx < query.length; i++) {
          if (nameLower[i] === query[queryIdx]) {
            fuzzyScore++;
            queryIdx++;
          }
        }
        if (queryIdx === query.length) {
          // All query chars found in name
          score += fuzzyScore * 20;
        }
      }
      
      // Bonuses
      if (score > 0) {
        if (cert.status !== "revoked") score += 20;
        if (cert.createdAt) {
          const daysOld = (Date.now() - new Date(cert.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          if (daysOld < 30) score += 10;
        }
      }
      
      return { cert, score };
    });
    
    // Sort by score and return top results
    const topResults = scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.cert);
    
    const certsData = topResults.map(({ _id, ...cert }) => ({
      ...cert,
      createdAt: cert.createdAt?.toISOString(),
      updatedAt: cert.updatedAt?.toISOString(),
      revokedAt: cert.revokedAt?.toISOString(),
      verifiedAt: cert.verifiedAt?.toISOString(),
      status: (cert.status || "issued") as any,
    }));
    
    return c.json({
      success: true,
      data: certsData,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message || "Failed to search certificates" }, 500);
  }
});

// Enhanced Public search certificates with smart ranking
app.get("/api/certificates/search/public", async (c) => {
  try {
    const query = (c.req.query("q") || "").trim();
    const limit = Math.min(parseInt(c.req.query("limit") || "20"), 50);
    
    const certificatesCollection = await getCollection<Certificate>("certificates");
    
    if (!query) {
      return c.json({ success: true, data: [] });
    }
    
    // Improved regex patterns for better matching
    const queryEscaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const exactRegex = new RegExp(`^${queryEscaped}$`, "i");
    const startsWithRegex = new RegExp(`^${queryEscaped}`, "i");
    const containsRegex = new RegExp(queryEscaped, "i");
    
    // Get all matching certificates
    const certificates = await certificatesCollection
      .find({
        status: { $ne: "revoked" }, // Only show non-revoked
        $or: [
          { id: containsRegex },
          { rollNo: containsRegex },
          { name: containsRegex },
        ],
      })
      .limit(100)
      .toArray();
    
    // Ranking algorithm for relevance
    const scored = certificates.map((cert) => {
      let score = 0;
      
      // ID matching (highest priority for public search)
      if (cert.id?.toLowerCase() === query.toLowerCase()) score += 1000;
      else if (exactRegex.test(cert.id || "")) score += 800;
      else if (startsWithRegex.test(cert.id || "")) score += 600;
      else if (containsRegex.test(cert.id || "")) score += 400;
      
      // Roll number matching
      if (cert.rollNo?.toLowerCase() === query.toLowerCase()) score += 950;
      else if (exactRegex.test(cert.rollNo || "")) score += 750;
      else if (startsWithRegex.test(cert.rollNo || "")) score += 550;
      else if (containsRegex.test(cert.rollNo || "")) score += 350;
      
      // Name matching
      if (cert.name?.toLowerCase() === query.toLowerCase()) score += 900;
      else if (exactRegex.test(cert.name || "")) score += 700;
      else if (startsWithRegex.test(cert.name || "")) score += 500;
      else if (containsRegex.test(cert.name || "")) score += 300;
      
      return { cert, score };
    });
    
    // Sort and limit
    const topResults = scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.cert);
    
    const certsData = topResults.map(({ _id, ...cert }) => ({
      ...cert,
      createdAt: cert.createdAt?.toISOString(),
      updatedAt: cert.updatedAt?.toISOString(),
      revokedAt: cert.revokedAt?.toISOString(),
      verifiedAt: cert.verifiedAt?.toISOString(),
      status: (cert.status || "issued") as any,
    }));
    
    return c.json({
      success: true,
      data: certsData,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message || "Failed to search certificates" }, 500);
  }
});

// Get single certificate (admin only)
app.get("/api/certificates/:id", authMiddleware, adminMiddleware, async (c) => {
  try {
    const id = c.req.param("id");
    const certificatesCollection = await getCollection<Certificate>("certificates");
    
    const cert = await certificatesCollection.findOne({ id });
    
    if (!cert) {
      return c.json({ success: false, error: "Certificate not found" }, 404);
    }
    
    const { _id, ...certData } = cert;
    
    return c.json({
      success: true,
      data: {
        ...certData,
        createdAt: cert.createdAt?.toISOString(),
        updatedAt: cert.updatedAt?.toISOString(),
        verifiedAt: cert.verifiedAt?.toISOString(),
        revokedAt: cert.revokedAt?.toISOString(),
        status: (cert.status || "issued") as any,
      },
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message || "Failed to fetch certificate" }, 500);
  }
});

// Create certificate (admin only)
app.post("/api/certificates", authMiddleware, adminMiddleware, zValidator("json", CertificateCreateSchema), async (c) => {
  try {
    const data = c.req.valid("json");
    const certificatesCollection = await getCollection<Certificate>("certificates");
    
    // Generate professional certificate ID
    const id = await generateCertificateId();
    
    const certificate: Certificate = {
      id,
      name: data.name,
      course: data.course,
      date: data.date,
      grade: data.grade,
      internshipDomain: data.internshipDomain,
      internshipStartDate: data.internshipStartDate,
      internshipEndDate: data.internshipEndDate,
      status: "issued",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await certificatesCollection.insertOne(certificate);
    
    const { _id, ...certData } = certificate;
    
    return c.json({
      success: true,
      data: {
        ...certData,
        createdAt: certificate.createdAt?.toISOString(),
        updatedAt: certificate.updatedAt?.toISOString(),
        revokedAt: certificate.revokedAt?.toISOString(),
        status: (certificate.status || "issued") as any,
      },
    }, 201);
  } catch (error: any) {
    return c.json({ success: false, error: error.message || "Failed to create certificate" }, 400);
  }
});

// Bulk create certificates (admin only)
app.post("/api/certificates/bulk", authMiddleware, adminMiddleware, zValidator("json", z.array(CertificateCreateSchema)), async (c) => {
  try {
    const certificatesData = c.req.valid("json");
    const mode = (c.req.query("mode") || "merge") as "merge" | "sync"; // sync mode: replace all with new data
    const certificatesCollection = await getCollection<Certificate>("certificates");
    const studentsCollection = await getCollection<Student>("students");
    
    // Validation: Check for duplicates and validate data
    const validationErrors: string[] = [];
    const seenKeys = new Set<string>();
    const uniqueCertificates: typeof certificatesData = [];
    const duplicateCount: number[] = [];
    
    certificatesData.forEach((cert, index) => {
      // Check for duplicate entries: name + course + date combination
      const key = `${cert.name}`.trim().toLowerCase() + "||" + `${cert.course}`.trim().toLowerCase() + "||" + `${cert.date}`.trim();
      if (seenKeys.has(key)) {
        duplicateCount.push(index + 1);
        return; // Skip this duplicate
      }
      seenKeys.add(key);
      
      // Validate required fields
      if (!cert.name || !cert.name.trim()) {
        validationErrors.push(`Row ${index + 1}: Name is required`);
        return;
      }
      if (!cert.course || !cert.course.trim()) {
        validationErrors.push(`Row ${index + 1}: Course is required`);
        return;
      }
      if (!cert.date || !cert.date.trim()) {
        validationErrors.push(`Row ${index + 1}: Date is required`);
        return;
      }
      
      // Validate date format
      if (cert.date && isNaN(Date.parse(cert.date))) {
        validationErrors.push(`Row ${index + 1}: Invalid date format "${cert.date}"`);
        return;
      }
      
      uniqueCertificates.push(cert);
    });
    
    if (validationErrors.length > 0) {
      return c.json({ 
        success: false, 
        error: `Validation errors:\n${validationErrors.join("\n")}` 
      }, 400);
    }
    
    // Create or update students and certificates
    const newCertificates: Certificate[] = [];
    const updatedCertificates: Certificate[] = [];
    const students: Student[] = [];
    
    for (const cert of uniqueCertificates) {
      // Check if student exists
      let student = (await studentsCollection.findOne({ 
        name: cert.name.trim(),
        course: cert.course.trim()
      })) as Student | null;
      
      // Create student if doesn't exist
      if (!student) {
        const studentId = `STU-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`.toUpperCase();
        student = {
          studentId,
          name: cert.name.trim(),
          course: cert.course.trim(),
          email: cert.email ? cert.email.trim().toLowerCase() : undefined,
          rollNo: cert.rollNo?.trim(),
          enrollmentDate: cert.date,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await studentsCollection.insertOne(student);
        students.push(student);
      } else if (!student.email && cert.email) {
        // Backfill student email if missing
        await studentsCollection.updateOne(
          { studentId: student.studentId },
          { $set: { email: cert.email.trim().toLowerCase(), updatedAt: new Date() } }
        );
      }
      
      // Use provided certificate ID or generate professional one
      const certId = cert.certificateId?.trim().toUpperCase() || await generateCertificateId();
      
      // Check if certificate already exists (by ID or by name+course+date)
      let existingCert = await certificatesCollection.findOne({ id: certId });
      
      // If no certificate ID match, try finding by name+course+date (same student, same cert)
      if (!existingCert) {
        existingCert = await certificatesCollection.findOne({ 
          name: cert.name.trim(),
          course: cert.course.trim(),
          date: cert.date.trim()
        });
      }
      
      // Update student with rollNo if provided
      if (cert.rollNo && (!student.rollNo || student.rollNo !== cert.rollNo.trim())) {
        await studentsCollection.updateOne(
          { studentId: student.studentId },
          { $set: { rollNo: cert.rollNo.trim(), updatedAt: new Date() } }
        );
        student.rollNo = cert.rollNo.trim();
      }
      
      // If certificate exists, update it; otherwise create new one
      if (existingCert) {
        // Update existing certificate with new data
        const updateData: Partial<Certificate> = {
          name: cert.name.trim(),
          course: cert.course.trim(),
          date: cert.date.trim(),
          rollNo: cert.rollNo?.trim(),
          grade: cert.grade?.trim(),
          ownerEmail: cert.email ? cert.email.trim().toLowerCase() : undefined,
          internshipDomain: cert.internshipDomain?.trim(),
          internshipStartDate: cert.internshipStartDate?.trim(),
          internshipEndDate: cert.internshipEndDate?.trim(),
          updatedAt: new Date(),
        };
        
        await certificatesCollection.updateOne(
          { id: existingCert.id },
          { $set: updateData }
        );
        
        updatedCertificates.push({
          ...existingCert,
          ...updateData,
          updatedAt: new Date(),
        } as Certificate);
      } else {
        // Create new certificate
        newCertificates.push({
          id: certId,
          name: cert.name.trim(),
          course: cert.course.trim(),
          date: cert.date.trim(),
          grade: cert.grade?.trim(),
          rollNo: cert.rollNo?.trim(),
          studentId: student.studentId,
          ownerEmail: cert.email ? cert.email.trim().toLowerCase() : undefined,
          internshipDomain: cert.internshipDomain?.trim(),
          internshipStartDate: cert.internshipStartDate?.trim(),
          internshipEndDate: cert.internshipEndDate?.trim(),
          status: "issued",
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Certificate);
      }
    }
    
    if (newCertificates.length === 0 && updatedCertificates.length === 0) {
      return c.json({ 
        success: false, 
        error: validationErrors.length > 0 
          ? validationErrors.join("\n") 
          : "No new or updated certificates to process" 
      }, 400);
    }
    
    // In sync mode, delete certificates not in the current upload
    if (mode === "sync") {
      const uploadedIds = new Set<string>();
      const uploadedStudents = new Map<string, Set<string>>();
      
      // Collect IDs and student+course combinations from current upload
      const allCertsToKeep = [...newCertificates, ...updatedCertificates];
      allCertsToKeep.forEach(cert => {
        uploadedIds.add(cert.id);
        const key = `${cert.name.toLowerCase()}||${cert.course.toLowerCase()}`;
        if (!uploadedStudents.has(key)) {
          uploadedStudents.set(key, new Set());
        }
        uploadedStudents.get(key)!.add(cert.date.toLowerCase());
      });
      
      // Get all existing certificates
      const allExistingCerts = await certificatesCollection.find({}).toArray();
      
      // Find certificates to delete (not in current upload)
      const certsToDelete = allExistingCerts.filter(existing => {
        // Don't delete if ID is in the upload
        if (uploadedIds.has(existing.id)) return false;
        
        // Don't delete if name+course+date is in the upload
        const key = `${existing.name.toLowerCase()}||${existing.course.toLowerCase()}`;
        if (uploadedStudents.has(key) && uploadedStudents.get(key)!.has(existing.date.toLowerCase())) {
          return false;
        }
        
        // Delete if not found in upload
        return true;
      });
      
      // Delete old certificates
      if (certsToDelete.length > 0) {
        const idsToDelete = certsToDelete.map(c => c.id);
        await certificatesCollection.deleteMany({ id: { $in: idsToDelete } });
      }
    }
    
    // Insert only the new certificates
    if (newCertificates.length > 0) {
      await certificatesCollection.insertMany(newCertificates);
    }
    
    // Clear cache after upload to ensure fresh data is used
    dbCache.invalidate("certificates");
    
    const allCertificates = [...newCertificates, ...updatedCertificates];
    const created = allCertificates.map(({ _id, ...cert }) => ({
      ...cert,
      createdAt: cert.createdAt?.toISOString(),
      updatedAt: cert.updatedAt?.toISOString(),
    }));
    
    const modeMessage = mode === "sync" ? " (sync mode - old data removed)" : "";
    const duplicatesMessage = duplicateCount.length > 0 ? ` (${duplicateCount.length} duplicate(s) removed)` : "";
    const message = `${newCertificates.length} new certificate(s) created, ${updatedCertificates.length} existing certificate(s) updated${modeMessage}${duplicatesMessage}`;
    
    return c.json({
      success: true,
      data: created,
      count: allCertificates.length,
      created: newCertificates.length,
      updated: updatedCertificates.length,
      duplicatesRemoved: duplicateCount.length,
      mode: mode,
      message: message,
      warnings: validationErrors.length > 0 ? validationErrors : undefined,
    }, 201);
  } catch (error: any) {
    console.error("Bulk create error:", error);
    return c.json({ 
      success: false, 
      error: error.message || "Failed to create certificates. Please check data integrity." 
    }, 400);
  }
});

// Update certificate (admin only)
app.put("/api/certificates/:id", authMiddleware, adminMiddleware, zValidator("json", CertificateCreateSchema), async (c) => {
  try {
    const id = c.req.param("id");
    const data = c.req.valid("json");
    const certificatesCollection = await getCollection<Certificate>("certificates");
    
    const updateResult = await certificatesCollection.updateOne(
      { id },
      {
        $set: {
          name: data.name,
          course: data.course,
          date: data.date,
          grade: data.grade,
          updatedAt: new Date(),
        },
      }
    );
    
    if (updateResult.matchedCount === 0) {
      return c.json({ success: false, error: "Certificate not found" }, 404);
    }
    
    const cert = await certificatesCollection.findOne({ id });
    if (!cert) {
      return c.json({ success: false, error: "Certificate not found" }, 404);
    }
    
    const { _id, ...certData } = cert;
    
    return c.json({
      success: true,
      data: {
        ...certData,
        createdAt: cert.createdAt?.toISOString(),
        updatedAt: cert.updatedAt?.toISOString(),
        revokedAt: cert.revokedAt?.toISOString(),
        status: (cert.status || "issued") as any,
      },
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message || "Failed to update certificate" }, 400);
  }
});

// Revoke certificate (admin only)
app.post(
  "/api/certificates/:id/revoke",
  authMiddleware,
  adminMiddleware,
  zValidator("json", z.object({ reason: z.string().min(1).max(500).optional() }).optional()),
  async (c) => {
    try {
      const id = c.req.param("id");
      const body = (c.req.valid("json") as any) || {};
      const certificatesCollection = await getCollection<Certificate>("certificates");
      const cert = await certificatesCollection.findOne({ id });
      if (!cert) return c.json({ success: false, error: "Certificate not found" }, 404);

      await certificatesCollection.updateOne(
        { id },
        {
          $set: {
            status: "revoked",
            revokedAt: new Date(),
            revokedReason: body.reason?.trim() || "Revoked by admin",
            updatedAt: new Date(),
          },
        }
      );

      const updated = await certificatesCollection.findOne({ id });
      if (!updated) return c.json({ success: false, error: "Certificate not found" }, 404);
      const { _id, ...certData } = updated as any;
      return c.json({
        success: true,
        data: {
          ...certData,
          createdAt: updated.createdAt?.toISOString(),
          updatedAt: updated.updatedAt?.toISOString(),
          revokedAt: updated.revokedAt?.toISOString(),
          status: (updated.status || "issued") as any,
        },
      });
    } catch (error: any) {
      return c.json({ success: false, error: error.message || "Failed to revoke certificate" }, 500);
    }
  }
);

// Delete certificate (admin only)
app.delete("/api/certificates/:id", authMiddleware, adminMiddleware, async (c) => {
  try {
    const id = c.req.param("id");
    const certificatesCollection = await getCollection<Certificate>("certificates");
    
    const cert = await certificatesCollection.findOne({ id });
    
    if (!cert) {
      return c.json({ success: false, error: "Certificate not found" }, 404);
    }
    
    await certificatesCollection.deleteOne({ id });
    
    return c.json({
      success: true,
      message: "Certificate deleted",
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message || "Failed to delete certificate" }, 500);
  }
});

// Request OTP for certificate verification
app.post(
  "/api/certificates/:id/request-otp",
  zValidator("json", z.object({ email: z.string().email() })),
  async (c) => {
    try {
      const id = c.req.param("id");
      const { email } = c.req.valid("json");
      const certificatesCollection = await getCollection<Certificate>("certificates");
      
      const cert = await certificatesCollection.findOne({ id });
      if (!cert) {
        return c.json({ success: false, error: "Certificate not found" }, 404);
      }
      
      // Verify email matches ONLY the certificate owner email from admin's data entry
      // It doesn't matter who is logged in - only the admin-uploaded email matters
      const expectedEmail = cert.ownerEmail;
      
      console.log(`OTP Request - Certificate: ${id}, Entered Email: ${email}, Database Email: ${expectedEmail}`);
      
      if (expectedEmail && email.toLowerCase() !== expectedEmail.toLowerCase()) {
        return c.json({ success: false, error: `Email does not match certificate owner. Expected: ${expectedEmail}, Got: ${email}` }, 403);
      }
      
      // Generate and send OTP
      const otp = generateOTP();
      await createOTPVerification(id, email, otp);
      try {
        await sendOTPEmail(email, otp, cert.name);
      } catch (err: any) {
        console.error("OTP email send failed:", {
          certificateId: id,
          email,
          error: err?.message || String(err),
        });
        return c.json({ success: false, error: "Failed to send OTP email. Please try again later." }, 502);
      }
      
      return c.json({
        success: true,
        message: "OTP sent to your email",
      });
    } catch (error: any) {
      return c.json({ success: false, error: error.message || "Failed to send OTP" }, 500);
    }
  }
);

// Verify OTP and mark certificate as verified
app.post(
  "/api/certificates/:id/verify-otp",
  zValidator("json", z.object({ email: z.string().email(), otp: z.string().length(6) })),
  async (c) => {
    try {
      const id = c.req.param("id");
      const { email, otp } = c.req.valid("json");
      const certificatesCollection = await getCollection<Certificate>("certificates");
      
      const cert = await certificatesCollection.findOne({ id });
      if (!cert) {
        return c.json({ success: false, error: "Certificate not found" }, 404);
      }
      
      const isValid = await verifyOTPRecord(id, email, otp);
      if (!isValid) {
        return c.json({ success: false, error: "Invalid or expired OTP" }, 400);
      }
      
      // Mark certificate as verified AND claimed (only happens after successful verification)
      // This ensures only the person with the correct email can claim it
      await certificatesCollection.updateOne(
        { id },
        { $set: { verifiedAt: new Date(), claimedAt: new Date(), updatedAt: new Date() } }
      );
      
      // Clear this certificate from cache to ensure fresh data
      dbCache.invalidate("certificates", id);
      
      const updated = await certificatesCollection.findOne({ id });
      if (!updated) {
        return c.json({ success: false, error: "Certificate not found" }, 404);
      }
      
      const { _id, ...certData } = updated;
      return c.json({
        success: true,
        data: {
          ...certData,
          createdAt: updated.createdAt?.toISOString(),
          updatedAt: updated.updatedAt?.toISOString(),
          verifiedAt: updated.verifiedAt?.toISOString(),
          revokedAt: updated.revokedAt?.toISOString(),
          status: (updated.status || "issued") as any,
        },
        message: "Certificate verified successfully",
      });
    } catch (error: any) {
      return c.json({ success: false, error: error.message || "Failed to verify OTP" }, 500);
    }
  }
);

// User management routes (admin only) - only users collection, no role changes
app.get("/api/users", authMiddleware, adminMiddleware, async (c) => {
  try {
    const usersCollection = await getCollection<User>("users");
    const page = Math.max(1, Number(c.req.query("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") || 20)));
    const skip = (page - 1) * limit;

    const [total, users] = await Promise.all([
      usersCollection.countDocuments({}),
      usersCollection.find({}).project({ password: 0 }).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    ]);

    const items = users.map(({ _id, ...user }) => ({
      ...user,
      role: "user" as const,
      createdAt: user.createdAt?.toISOString(),
      updatedAt: user.updatedAt?.toISOString(),
    }));

    return c.json({ success: true, data: { items, page, limit, total } });
  } catch (error: any) {
    return c.json({ success: false, error: error.message || "Failed to fetch users" }, 500);
  }
});

app.delete("/api/users/:email", authMiddleware, adminMiddleware, async (c) => {
  try {
    const email = decodeURIComponent(c.req.param("email")).toLowerCase();
    const admin = c.get("admin") as Admin;

    // prevent admin from deleting a user account that matches their admin email
    if (admin.email === email) {
      return c.json({ success: false, error: "You cannot delete this account" }, 400);
    }

    const usersCollection = await getCollection<User>("users");
    const result = await usersCollection.deleteOne({ email });

    if (result.deletedCount === 0) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    // also unassign certificates from this user (optional safety)
    const certificatesCollection = await getCollection<Certificate>("certificates");
    await certificatesCollection.updateMany(
      { ownerEmail: email },
      { $unset: { ownerEmail: "", claimedAt: "" }, $set: { updatedAt: new Date() } }
    );

    return c.json({ success: true, message: "User deleted" });
  } catch (error: any) {
    return c.json({ success: false, error: error.message || "Failed to delete user" }, 500);
  }
});

// Send OTP for certificate verification
app.post("/api/send-otp", async (c) => {
  try {
    const contentType = c.req.header("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return c.json({ success: false, error: "Content-Type must be application/json" }, 400);
    }

    let body;
    try {
      body = await c.req.json();
    } catch (e) {
      return c.json({ success: false, error: "Invalid JSON in request body" }, 400);
    }

    const { type, contact, certificateId } = body;

    // Validate input
    if (!type || !["mobile", "email"].includes(type)) {
      return c.json({ success: false, error: "Invalid type: must be 'mobile' or 'email'" }, 400);
    }
    if (!contact || contact.length < 3) {
      return c.json({ success: false, error: "Invalid contact information" }, 400);
    }
    if (!certificateId) {
      return c.json({ success: false, error: "Certificate ID is required" }, 400);
    }

    // Generate OTP
    const otp = generateOTP();
    console.log(`Generated OTP for ${certificateId}: ${otp}`);

    // Store OTP record
    const otpsCollection = await getCollection("otp_verifications");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    const otpRecord = {
      certificateId,
      type,
      contact: contact.toLowerCase(),
      otp,
      expiresAt,
      verified: false,
      createdAt: new Date(),
    };

    // Delete existing unverified OTPs for this certificate
    await otpsCollection.deleteMany({
      certificateId,
      type,
      contact: contact.toLowerCase(),
      verified: false,
    } as any);

    await otpsCollection.insertOne(otpRecord as any);

    // Log OTP for development
    if (type === "email") {
      console.log(`\n📧 OTP Email to ${contact}:`);
      console.log(`   Subject: VeriVault Certificate Verification OTP`);
      console.log(`   Your OTP: ${otp}`);
      console.log(`   This OTP is valid for 10 minutes.\n`);
    } else {
      console.log(`\n📱 SMS to ${contact}:`);
      console.log(`   Your VeriVault OTP: ${otp}`);
      console.log(`   Valid for 10 minutes.\n`);
    }

    return c.json({
      success: true,
      message: `OTP sent to your ${type}`,
      contact: contact.substring(0, 3) + "***" + contact.substring(contact.length - 3),
    });
  } catch (error: any) {
    console.error("Send OTP Error:", error);
    return c.json({
      success: false,
      error: error?.message || "Failed to send OTP"
    }, 500);
  }
});

// Verify OTP for certificate
app.post("/api/verify-otp", async (c) => {
  try {
    const contentType = c.req.header("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return c.json({ success: false, error: "Content-Type must be application/json" }, 400);
    }

    let body;
    try {
      body = await c.req.json();
    } catch (e) {
      return c.json({ success: false, error: "Invalid JSON in request body" }, 400);
    }

    const { type, contact, otp, certificateId } = body;

    // Validate input
    if (!type || !["mobile", "email"].includes(type)) {
      return c.json({ success: false, error: "Invalid type" }, 400);
    }
    if (!contact || contact.length < 3) {
      return c.json({ success: false, error: "Invalid contact" }, 400);
    }
    if (!otp || otp.length !== 6 || !/^\d+$/.test(otp)) {
      return c.json({ success: false, error: "Invalid OTP format" }, 400);
    }
    if (!certificateId) {
      return c.json({ success: false, error: "Certificate ID is required" }, 400);
    }

    const otpsCollection = await getCollection("otp_verifications");
    const otpRecord = await otpsCollection.findOne({
      certificateId,
      type,
      contact: contact.toLowerCase(),
      verified: false,
    } as any);

    if (!otpRecord) {
      console.log(`OTP record not found for ${certificateId}, ${type}, ${contact}`);
      return c.json({ success: false, error: "OTP not found or already verified" }, 400);
    }

    // Check if OTP is expired
    if (new Date() > otpRecord.expiresAt) {
      return c.json({ success: false, error: "OTP has expired" }, 400);
    }

    // Verify OTP
    if (otpRecord.otp !== otp) {
      console.log(`OTP mismatch: stored=${otpRecord.otp}, provided=${otp}`);
      return c.json({ success: false, error: "Invalid OTP" }, 400);
    }

    // Mark OTP as verified
    await otpsCollection.updateOne(
      { _id: otpRecord._id } as any,
      { $set: { verified: true, verifiedAt: new Date() } } as any
    );

    // Update certificate with verification info (optional, doesn't fail if cert not found)
    const certificatesCollection = await getCollection<Certificate>("certificates");
    await certificatesCollection.updateOne(
      { id: certificateId } as any,
      {
        $set: {
          verified: true,
          verifiedBy: type,
          verifiedAt: new Date(),
          updatedAt: new Date(),
        },
      } as any
    ).catch(err => console.log("Certificate update skipped:", err));

    return c.json({
      success: true,
      message: "Certificate verified successfully",
    });
  } catch (error: any) {
    console.error("Verify OTP Error:", error);
    return c.json({
      success: false,
      error: error?.message || "Failed to verify OTP"
    }, 500);
  }
});

// Admin endpoint to clear all certificates (for resetting data)
app.delete("/api/admin/certificates/clear-all", async (c) => {
  try {
    const db = await connectToDatabase();
    const certificatesCollection = db.collection("certificates");
    
    const result = await certificatesCollection.deleteMany({});
    
    // Invalidate all caches
    dbCache.invalidate("certificates");
    
    console.log(`[ADMIN] Cleared ${result.deletedCount} certificates from database`);
    
    return c.json({
      success: true,
      message: `Deleted ${result.deletedCount} certificates`,
      deletedCount: result.deletedCount
    });
  } catch (error: any) {
    console.error("[ADMIN] Clear certificates error:", error);
    return c.json({
      success: false,
      error: error?.message || "Failed to clear certificates"
    }, 500);
  }
});

export default app;
