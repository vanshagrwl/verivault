import * as crypto from "crypto";
import { getCollection } from "./mongodb";
import type { OtpVerification } from "./models";

// Generate 6-digit OTP
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Hash OTP for storage
export async function hashOTP(otp: string): Promise<string> {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

// Verify OTP
export async function verifyOTP(otp: string, hashedOTP: string): Promise<boolean> {
  const hash = await hashOTP(otp);
  return hash === hashedOTP;
}

// Create OTP record
export async function createOTPVerification(
  certificateId: string,
  email: string,
  otp: string
): Promise<OtpVerification> {
  const otpsCollection = await getCollection<OtpVerification>("otp_verifications");
  const hashedOTP = await hashOTP(otp);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Delete any existing unverified OTPs for this cert+email
  await otpsCollection.deleteMany({
    certificateId,
    email: email.toLowerCase(),
    verified: false,
  });

  const otpRecord: OtpVerification = {
    certificateId,
    email: email.toLowerCase(),
    otp: hashedOTP,
    expiresAt,
    verified: false,
    createdAt: new Date(),
  };

  const result = await otpsCollection.insertOne(otpRecord);
    // For development/testing, log the plaintext once so the operator can verify delivery.
    if (process.env.NODE_ENV !== "production") {
      console.log(`Generated verification password for ${certificateId}: ${otp}`);
    }

    return { ...otpRecord, _id: result.insertedId };
}

// Verify OTP
export async function verifyOTPRecord(
  certificateId: string,
  email: string,
  otp: string
): Promise<boolean> {
  const otpsCollection = await getCollection<OtpVerification>("otp_verifications");
  const record = await otpsCollection.findOne({
    certificateId,
    email: email.toLowerCase(),
    verified: false,
  });

  if (!record) return false;
  if (record.expiresAt < new Date()) return false;

  const isValid = await verifyOTP(otp, record.otp);
  if (isValid) {
    await otpsCollection.updateOne(
      { _id: record._id },
      { $set: { verified: true } }
    );
  }
  return isValid;
}

function isNodeRuntime(): boolean {
  // Cloudflare Workers may expose a `process` polyfill via nodejs_compat, but not a real Node runtime.
  return typeof process !== "undefined" && !!(process as any).versions?.node;
}

// ---- Gmail SMTP helper ----
let cachedTransporter: any | null = null;

async function getSmtpTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const host = (process.env.SMTP_HOST || "smtp.gmail.com").trim();
  const port = Number(process.env.SMTP_PORT || "465") || 465;
  const user = (process.env.SMTP_USER || process.env.FROM_EMAIL || "").trim();
  const pass = (process.env.SMTP_PASS || "").trim();

  if (!user || !pass) {
    throw new Error("SMTP_USER/SMTP_PASS not configured");
  }

  // Nodemailer is CommonJS; use dynamic import.
  const mod: any = await import("nodemailer");
  const nodemailer = mod?.default ?? mod;

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return cachedTransporter;
}

// Send OTP email via Gmail SMTP (falls back to console log if not configured)
export async function sendOTPEmail(email: string, otp: string, studentName: string): Promise<void> {
  const subject = "VeriVault Certificate Verification OTP";
  const text = `Hello ${studentName},

Your OTP for certificate verification is: ${otp}

This OTP is valid for 10 minutes.

Regards,
VeriVault Team
`;

  const from = (process.env.FROM_EMAIL || "").trim() || (process.env.SMTP_USER || "").trim();

  if (!isNodeRuntime()) {
    console.log(`\n📧 OTP Email (dev fallback, non-Node runtime) to ${email}:`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Body: ${text}`);
    return;
  }

  if (!from) {
    console.log(`\n📧 OTP Email (dev fallback, missing FROM_EMAIL) to ${email}:`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Body: ${text}`);
    return;
  }

  try {
    const transporter = await getSmtpTransporter();

    await transporter.sendMail({
      from,
      to: email,
      subject,
      text,
      html: `<p>Hello ${studentName},</p>
<p>Your OTP for certificate verification is: <strong>${otp}</strong></p>
<p>This OTP is valid for 10 minutes.</p>
<p>Regards,<br/>VeriVault Team</p>`,
    });

    if (process.env.NODE_ENV !== "production") {
      console.log(`✓ OTP email sent via SMTP to ${email}`);
    }
  } catch (err: any) {
    console.error("SMTP OTP email error:", err?.message || err);
    throw new Error("Failed to send OTP email via SMTP");
  }
}
