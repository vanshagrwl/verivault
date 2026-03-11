/**
 * Advanced Search Utility with Fuzzy Matching and Relevance Scoring
 * Provides intelligent certificate search with ranking and filtering
 */

import type { Certificate } from "../shared/types";

interface SearchResult {
  certificate: Certificate;
  score: number;
  matchedFields: string[];
  highlights: Record<string, string>;
}

/**
 * Levenshtein distance - measures similarity between two strings
 * Lower distance = more similar (0 means exact match)
 */
function levenshteinDistance(a: string, b: string): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();

  if (aLower === bLower) return 0;
  if (aLower.length === 0) return bLower.length;
  if (bLower.length === 0) return aLower.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= bLower.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= aLower.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bLower.length; i++) {
    for (let j = 1; j <= aLower.length; j++) {
      const cost = aLower[j - 1] === bLower[i - 1] ? 0 : 1;

      matrix[i][j] = Math.min(
        matrix[i][j - 1] + 1,
        matrix[i - 1][j] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[bLower.length][aLower.length];
}

/**
 * Check if query is found in text (case-insensitive)
 */
function contains(text: string | undefined, query: string): boolean {
  if (!text) return false;
  return text.toLowerCase().includes(query.toLowerCase());
}

/**
 * Check if text starts with query (case-insensitive)
 */
function startsWith(text: string | undefined, query: string): boolean {
  if (!text) return false;
  return text.toLowerCase().startsWith(query.toLowerCase());
}

/**
 * Calculate similarity ratio (0-1) based on Levenshtein distance
 */
function getSimilarityRatio(a: string, b: string): number {
  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;
  return Math.max(0, (maxLength - distance) / maxLength);
}

/**
 * Highlight matched text in a string
 */
function highlightMatches(text: string | undefined, query: string): string {
  if (!text) return "";

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return text.replace(regex, "<mark>$1</mark>");
}

/**
 * Score a certificate based on query match
 */
function scoreCertificate(cert: Certificate, query: string): { score: number; matched: string[] } {
  let score = 0;
  const matched: string[] = [];
  const queryLower = query.toLowerCase();

  // Exact match (100 points)
  if (cert.id?.toLowerCase() === queryLower) {
    score += 100;
    matched.push("id");
  } else if (cert.name?.toLowerCase() === queryLower) {
    score += 95;
    matched.push("name");
  } else if (cert.rollNo?.toLowerCase() === queryLower) {
    score += 90;
    matched.push("rollNo");
  }

  // Starts with query (80 points for primary fields)
  if (!matched.includes("id") && startsWith(cert.id, query)) {
    score += 80;
    matched.push("id");
  }
  if (!matched.includes("name") && startsWith(cert.name, query)) {
    score += 75;
    matched.push("name");
  }
  if (!matched.includes("rollNo") && startsWith(cert.rollNo, query)) {
    score += 70;
    matched.push("rollNo");
  }

  // Contains query (50-60 points)
  if (!matched.includes("id") && contains(cert.id, query)) {
    score += 60;
    matched.push("id");
  }
  if (!matched.includes("name") && contains(cert.name, query)) {
    score += 55;
    matched.push("name");
  }
  if (!matched.includes("course") && contains(cert.course, query)) {
    score += 45;
    matched.push("course");
  }
  if (!matched.includes("rollNo") && contains(cert.rollNo, query)) {
    score += 40;
    matched.push("rollNo");
  }
  if (!matched.includes("email") && contains(cert.ownerEmail || cert.email, query)) {
    score += 30;
    matched.push("email");
  }

  // Fuzzy match (similarity-based scoring)
  const fuzzyThreshold = 0.7; // 70% similarity
  if (!matched.includes("id")) {
    const idSimilarity = getSimilarityRatio(cert.id || "", query);
    if (idSimilarity > fuzzyThreshold) {
      score += idSimilarity * 50;
      matched.push("id");
    }
  }
  if (!matched.includes("name")) {
    const nameSimilarity = getSimilarityRatio(cert.name || "", query);
    if (nameSimilarity > fuzzyThreshold) {
      score += nameSimilarity * 45;
      matched.push("name");
    }
  }
  if (!matched.includes("rollNo")) {
    const rollNoSimilarity = getSimilarityRatio(cert.rollNo || "", query);
    if (rollNoSimilarity > fuzzyThreshold) {
      score += rollNoSimilarity * 40;
      matched.push("rollNo");
    }
  }

  // Boost for non-revoked certificates
  if (cert.status !== "revoked") {
    score += 5;
  }

  return { score, matched: [...new Set(matched)] };
}

/**
 * Advanced search function
 */
export function advancedSearch(
  certificates: Certificate[],
  query: string,
  options?: {
    limit?: number;
    filterStatus?: "all" | "issued" | "revoked";
    fuzzyEnabled?: boolean;
  }
): SearchResult[] {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const trimmedQuery = query.trim();
  const filterStatus = options?.filterStatus ?? "all";
  const fuzzyEnabled = options?.fuzzyEnabled ?? true;
  const limit = options?.limit ?? 50;

  // Filter certificates based on status
  let filtered = certificates.filter((cert) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "issued") return cert.status !== "revoked";
    if (filterStatus === "revoked") return cert.status === "revoked";
    return true;
  });

  // Score and rank
  const scored = filtered.map((cert) => {
    const { score, matched } = scoreCertificate(cert, trimmedQuery);
    
    if (score === 0 && !fuzzyEnabled) {
      return null;
    }

    return {
      certificate: cert,
      score,
      matchedFields: matched,
      highlights: {
        id: highlightMatches(cert.id, trimmedQuery),
        name: highlightMatches(cert.name, trimmedQuery),
        course: highlightMatches(cert.course, trimmedQuery),
        rollNo: highlightMatches(cert.rollNo, trimmedQuery),
      },
    };
  });

  // Remove null entries and sort by score (descending)
  return (scored.filter((item) => item !== null) as SearchResult[])
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Get search suggestions from certificates
 */
export function getSearchSuggestions(certificates: Certificate[], query: string, limit: number = 5): string[] {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const suggestions = new Set<string>();
  const queryLower = query.toLowerCase();

  certificates.forEach((cert) => {
    if (suggestions.size >= limit) return;

    // Add name if it contains query
    if (cert.name?.toLowerCase().includes(queryLower) && !suggestions.has(cert.name)) {
      suggestions.add(cert.name);
    }

    // Add course if it contains query
    if (cert.course?.toLowerCase().includes(queryLower) && !suggestions.has(cert.course)) {
      suggestions.add(cert.course);
    }

    // Add ID if it contains query
    if (cert.id?.toLowerCase().includes(queryLower) && !suggestions.has(cert.id)) {
      suggestions.add(cert.id);
    }

    // Add roll no if it contains query
    if (cert.rollNo?.toLowerCase().includes(queryLower) && !suggestions.has(cert.rollNo)) {
      suggestions.add(cert.rollNo);
    }
  });

  return Array.from(suggestions).slice(0, limit);
}
