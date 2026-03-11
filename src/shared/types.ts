import z from "zod";

// Certificate Schema
export const CertificateSchema = z.object({
  id: z.string(),
  name: z.string(),
  course: z.string(),
  date: z.string(),
  grade: z.string().optional(),
  rollNo: z.string().optional(),
  email: z.string().email().optional(),
  ownerEmail: z.string().email().optional(),
  status: z.enum(["issued", "revoked"]).optional(),
  revokedAt: z.string().optional(),
  revokedReason: z.string().optional(),
  verifiedAt: z.string().optional(),
  createdAt: z.string().optional(),
  internshipDomain: z.string().optional(),
  internshipStartDate: z.string().optional(),
  internshipEndDate: z.string().optional(),
});

export type Certificate = z.infer<typeof CertificateSchema>;

// Login Schema
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginRequest = z.infer<typeof LoginSchema>;

// Register Schema
export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
});

export type RegisterRequest = z.infer<typeof RegisterSchema>;

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface LoginResponse {
  user: {
    email: string;
    role?: "admin" | "user";
  };
}

// Certificate Create/Update Schema
export const CertificateCreateSchema = z.object({
  name: z.string().min(1),
  course: z.string().min(1),
  date: z.string(),
  grade: z.string().optional(),
  email: z.string().email().optional(),
  rollNo: z.string().optional(),
  certificateId: z.string().optional(), // Optional pre-defined certificate ID
  internshipDomain: z.string().optional(),
  internshipStartDate: z.string().optional(),
  internshipEndDate: z.string().optional(),
});

export type CertificateCreate = z.infer<typeof CertificateCreateSchema>;
