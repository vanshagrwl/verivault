import { ObjectId } from "mongodb";

export interface User {
  _id?: ObjectId;
  email: string;
  password: string; // Hashed password
  // Not stored in DB anymore; included in some API responses for UI convenience.
  role?: "user";
  name?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Admin {
  _id?: ObjectId;
  email: string;
  password: string; // Hashed password
  role?: "admin";
  name?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Student {
  _id?: ObjectId;
  studentId?: string; // Unique student ID
  rollNo?: string; // Roll number from Excel
  name: string;
  email?: string;
  phone?: string;
  course: string;
  enrollmentDate?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Certificate {
  _id?: ObjectId;
  id: string; // Certificate ID (CERT-xxx)
  name: string;
  course: string;
  date: string;
  grade?: string;
  rollNo?: string; // Roll number from Excel
  studentId?: string; // Link to student if exists
  ownerEmail?: string; // User account email that owns this certificate
  claimedAt?: Date; // when the certificate was claimed by the owner (only set via claim API)
  internshipDomain?: string;
  internshipStartDate?: string;
  internshipEndDate?: string;
  semester?: string;
  issueDate?: string;
  expiryDate?: string;
  totalMarks?: string;
  obtainedMarks?: string;
  status?: "issued" | "revoked";
  revokedAt?: Date;
  revokedReason?: string;
  verified?: boolean; // Whether certificate has been verified via OTP
  verifiedBy?: "mobile" | "email"; // Method used for verification
  verifiedAt?: Date; // When OTP was verified
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OtpVerification {
  _id?: ObjectId;
  certificateId: string;
  // New OTP flow (certificateId + email) stores the email directly
  email?: string;
  // Legacy flow stores (type + contact)
  type?: "mobile" | "email";
  contact?: string; // Email or phone number
  otp: string; // The OTP itself
  expiresAt: Date;
  verified: boolean;
  verifiedAt?: Date;
  createdAt?: Date;
}
