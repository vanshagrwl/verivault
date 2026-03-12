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

// Send OTP email via Brevo HTTP API (works on Render because it's HTTPS)
// Requirements:
// - BREVO_API_KEY (or BREVO_SMTP_USER) set
// - FROM_EMAIL set to a verified Brevo sender (your Gmail can be verified in Brevo)
export async function sendOTPEmail(email: string, otp: string, studentName: string): Promise<void> {
  const subject = "VeriVault Certificate Verification OTP";
  const text = `Hello ${studentName},

Your OTP for certificate verification is: ${otp}

This OTP is valid for 10 minutes.

Regards,
VeriVault Team
`;

  try {
    const apiKey =
      process.env.BREVO_API_KEY?.trim() ||
      process.env.BREVO_SMTP_USER?.trim();
    const from = process.env.FROM_EMAIL?.trim();

    if (!apiKey || !from || !isNodeRuntime() || !(globalThis as any).fetch) {
      console.log(`\n📧 OTP Email (dev fallback) to ${email}:`);
      console.log(`   Subject: ${subject}`);
      console.log(`   Body: ${text}`);
      return;
    }

    const fetchFn: any = (globalThis as any).fetch;
    const payload = {
      sender: { email: from, name: "VeriVault" },
      to: [{ email, name: studentName }],
      subject,
      textContent: text,
      htmlContent: `<p>Hello ${studentName},</p>
<p>Your OTP for certificate verification is: <strong>${otp}</strong></p>
<p>This OTP is valid for 10 minutes.</p>
<p>Regards,<br/>VeriVault Team</p>`,
    };

    const res = await fetchFn("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      const safeMessage = String(bodyText || `HTTP ${res.status}`).slice(0, 300);
      console.error("Brevo API error:", res.status, safeMessage);
      throw new Error(`Brevo error (${res.status}): ${safeMessage}`);
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(`✓ OTP email sent via Brevo to ${email}`);
    }
  } catch (err: any) {
    const msg = err?.message || String(err);
    throw new Error(msg);
  }
}
