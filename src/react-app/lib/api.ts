import type { ApiResponse, LoginRequest, LoginResponse, Certificate, CertificateCreate } from "@/shared/types";
import type { User } from "@/lib/models";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function toErrorMessage(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "[object Object]") return undefined;
    return trimmed;
  }
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// API request helper
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: "include",
    });

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      // If response is not JSON, return error
      return {
        success: false,
        error: `Server error: ${response.status} ${response.statusText}`,
      };
    }

    if (!response.ok) {
      const message =
        toErrorMessage((data as any)?.error) ||
        toErrorMessage((data as any)?.message) ||
        `Request failed: ${response.status}`;
      return { 
        success: false, 
        error: message,
      };
    }

    // Normalize non-OK style responses that still return 200 with { success: false }
    if (data && typeof data === "object" && (data as any).success === false) {
      const message =
        toErrorMessage((data as any)?.error) ||
        toErrorMessage((data as any)?.message) ||
        "Request failed";
      return { ...(data as any), error: message };
    }

    return data;
  } catch (error) {
    console.error("API request error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error. Please check your connection.",
    };
  }
}

// Auth API
export const authApi = {
  loginAdmin: async (credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> => {
    return request<LoginResponse>("/auth/login/admin", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  },

  loginUser: async (credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> => {
    return request<LoginResponse>("/auth/login/user", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  },

  register: async (credentials: { email: string; password: string; name?: string }): Promise<ApiResponse<LoginResponse>> => {
    return request<LoginResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  },

  registerAdmin: async (credentials: { email: string; password: string; name?: string }): Promise<ApiResponse<LoginResponse>> => {
    return request<LoginResponse>("/auth/register/admin", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  },

  me: async (): Promise<ApiResponse<{ email: string; role: "admin" | "user"; name?: string }>> => {
    return request<{ email: string; role: "admin" | "user"; name?: string }>("/auth/me");
  },

  logout: async () => {
    await request<void>("/auth/logout", { method: "POST" });
  },
};

// Certificates API
export const certificatesApi = {
  verify: async (id: string): Promise<ApiResponse<Certificate>> => {
    return request<Certificate>(`/certificates/verify/${id}`);
  },

  getAll: async (params?: { page?: number; limit?: number }): Promise<ApiResponse<{ items: Certificate[]; page: number; limit: number; total: number }>> => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ items: Certificate[]; page: number; limit: number; total: number }>(`/certificates${suffix}`);
  },

  getById: async (id: string): Promise<ApiResponse<Certificate>> => {
    return request<Certificate>(`/certificates/${id}`);
  },

  create: async (data: CertificateCreate): Promise<ApiResponse<Certificate>> => {
    return request<Certificate>("/certificates", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  bulkCreate: async (certificates: CertificateCreate[], mode: "merge" | "sync" = "merge"): Promise<ApiResponse<{ data: Certificate[]; count: number; created: number; updated: number; message: string }>> => {
    return request<{ data: Certificate[]; count: number; created: number; updated: number; message: string }>(`/certificates/bulk?mode=${mode}`, {
      method: "POST",
      body: JSON.stringify(certificates),
    });
  },

  update: async (id: string, data: CertificateCreate): Promise<ApiResponse<Certificate>> => {
    return request<Certificate>(`/certificates/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string): Promise<ApiResponse<void>> => {
    return request<void>(`/certificates/${id}`, {
      method: "DELETE",
    });
  },

  revoke: async (id: string, reason?: string): Promise<ApiResponse<Certificate>> => {
    return request<Certificate>(`/certificates/${id}/revoke`, {
      method: "POST",
      body: JSON.stringify(reason ? { reason } : {}),
    });
  },

  search: async (query: string): Promise<ApiResponse<Certificate[]>> => {
    return request<Certificate[]>(`/certificates/search?q=${encodeURIComponent(query)}`);
  },

  searchPublic: async (query: string): Promise<ApiResponse<Certificate[]>> => {
    return request<Certificate[]>(`/certificates/search/public?q=${encodeURIComponent(query)}`);
  },

  my: async (): Promise<ApiResponse<Certificate[]>> => {
    return request<Certificate[]>("/my/certificates");
  },

  // Claim endpoint is also used for public search; server returns an optional
  // `alreadyClaimed` flag when the certificate record has a claimedAt timestamp.
  claim: async (
    certificateId: string
  ): Promise<ApiResponse<Certificate> & { alreadyClaimed?: boolean }> => {
    return request<Certificate>("/my/certificates/claim", {
      method: "POST",
      body: JSON.stringify({ certificateId }),
    });
  },

  requestOTP: async (certificateId: string, email: string): Promise<ApiResponse<{ message: string }>> => {
    return request<{ message: string }>(`/certificates/${certificateId}/request-otp`, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  verifyOTP: async (certificateId: string, email: string, otp: string): Promise<ApiResponse<Certificate>> => {
    return request<Certificate>(`/certificates/${certificateId}/verify-otp`, {
      method: "POST",
      body: JSON.stringify({ email, otp }),
    });
  },
};

// Users API
export const usersApi = {
  getAll: async (params?: { page?: number; limit?: number }): Promise<ApiResponse<{ items: User[]; page: number; limit: number; total: number }>> => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ items: User[]; page: number; limit: number; total: number }>(`/users${suffix}`);
  },

  delete: async (email: string): Promise<ApiResponse<void>> => {
    return request<void>(`/users/${encodeURIComponent(email)}`, {
      method: "DELETE",
    });
  },
};
