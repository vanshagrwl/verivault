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

// Send OTP email via Resend HTTP API (falls back to console log if not configured)
// Using HTTPS avoids SMTP port blocking and Brevo DNS issues on some hosts.
export async function sendOTPEmail(email: string, otp: string, studentName: string): Promise<void> {
  const subject = "VeriVault Certificate Verification OTP";
  const text = `Hello ${studentName},

Your OTP for certificate verification is: ${otp}

This OTP is valid for 10 minutes.

Regards,
VeriVault Team
`;

  const apiKey = process.env.RESEND_API_KEY?.trim();
  // Resend requires a verified sender. For quick testing you can use `onboarding@resend.dev`.
  const from = (process.env.FROM_EMAIL || process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev").trim();

  if (!apiKey || !from || !isNodeRuntime() || !(globalThis as any).fetch) {
    // Fallback for local/dev or misconfigured environments.
    console.log(`\n📧 OTP Email (dev fallback) to ${email}:`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Body: ${text}`);
    return;
  }

  const fetchFn: any = (globalThis as any).fetch;

  const payload = {
    from,
    to: [email],
    subject,
    text,
    html: `<p>Hello ${studentName},</p>
<p>Your OTP for certificate verification is: <strong>${otp}</strong></p>
<p>This OTP is valid for 10 minutes.</p>
<p>Regards,<br/>VeriVault Team</p>`,
  };

  const res = await fetchFn("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    let message = bodyText || `HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(bodyText || "{}");
      message =
        (typeof parsed?.message === "string" && parsed.message) ||
        (typeof parsed?.error === "string" && parsed.error) ||
        message;
    } catch {
      // keep message as text
    }

    const safeMessage = String(message).slice(0, 300);
    console.error("Resend API error:", res.status, safeMessage);
    throw new Error(`Resend error (${res.status}): ${safeMessage}`);
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`✓ OTP email sent to ${email}`);
  }
}
