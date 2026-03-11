import type { Certificate } from "@/shared/types";

export interface SearchSuggestion {
  type: "name" | "rollNo" | "course" | "id";
  value: string;
  count: number;
  emoji: string;
}

export interface SearchScore {
  certificate: Certificate;
  score: number;
  matchType: "exact" | "startsWith" | "includes" | "fuzzy";
  matchedFields: string[];
  primaryMatch?: string; // The field that had the best match
}

export interface ParsedSearchQuery {
  rawQuery: string;
  idSearch?: string;
  courseSearch?: string;
  nameSearch?: string;
  rollNoSearch?: string;
  generalTerms: string[];
  isFieldSpecific: boolean;
}

/**
 * Levenshtein distance algorithm for fuzzy matching
 * Returns the number of character edits needed to transform string1 to string2
 */
export const levenshteinDistance = (str1: string, str2: string): number => {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[len1][len2];
};

/**
 * Parse search query to detect field-specific searches
 * Supports: id:CERT-123, course:bca, name:anu, rollNo:123
 */
export const parseSearchQuery = (query: string): ParsedSearchQuery => {
  const parts = query.trim().split(/\s+/);
  const parsed: ParsedSearchQuery = {
    rawQuery: query,
    generalTerms: [],
    isFieldSpecific: false,
  };

  for (const part of parts) {
    if (part.startsWith("id:")) {
      parsed.idSearch = part.slice(3).toLowerCase();
      parsed.isFieldSpecific = true;
    } else if (part.startsWith("course:")) {
      parsed.courseSearch = part.slice(7).toLowerCase();
      parsed.isFieldSpecific = true;
    } else if (part.startsWith("name:")) {
      parsed.nameSearch = part.slice(5).toLowerCase();
      parsed.isFieldSpecific = true;
    } else if (part.startsWith("rollno:") || part.startsWith("roll:")) {
      const value = part.includes("rollno:") ? part.slice(7) : part.slice(5);
      parsed.rollNoSearch = value.toLowerCase();
      parsed.isFieldSpecific = true;
    } else if (part.length > 0) {
      parsed.generalTerms.push(part.toLowerCase());
    }
  }

  return parsed;
};

/**
 * Advanced fuzzy matching using Levenshtein distance
 * Returns score based on similarity (1.0 = identical, 0 = completely different)
 */
export const fuzzyMatchScore = (str1: string, str2: string): number => {
  if (!str1 || !str2) return 0;
  const maxLen = Math.max(str1.length, str2.length);
  const distance = levenshteinDistance(str1, str2);
  return Math.max(0, 1 - distance / maxLen);
};

/**
 * Calculate relevance score for a certificate based on search query
 * Uses advanced multi-field matching with field-specific searching
 */
export const calculateRelevanceScore = (
  certificate: Certificate,
  query: string
): SearchScore => {
  const parsed = parseSearchQuery(query);
  let score = 0;
  const matchedFields: string[] = [];
  let primaryMatch: string | undefined;

  const nameLower = certificate.name?.toLowerCase() || "";
  const rollNoLower = certificate.rollNo?.toLowerCase() || "";
  const courseLower = certificate.course?.toLowerCase() || "";
  const idLower = certificate.id?.toLowerCase() || "";

  // Field-specific search: ID
  if (parsed.idSearch) {
    if (idLower === parsed.idSearch) {
      score += 2000; // Exact ID match is top priority
      matchedFields.push("id");
      primaryMatch = "id";
    } else if (idLower.startsWith(parsed.idSearch)) {
      score += 1800;
      matchedFields.push("id");
      primaryMatch = "id";
    } else if (idLower.includes(parsed.idSearch)) {
      score += 1500;
      matchedFields.push("id");
      primaryMatch = "id";
    } else {
      const fuzzyScore = fuzzyMatchScore(idLower, parsed.idSearch);
      if (fuzzyScore > 0.7) {
        score += fuzzyScore * 400; // Fuzzy ID match
        matchedFields.push("id_fuzzy");
        primaryMatch = "id_fuzzy";
      }
    }
  }

  // Field-specific search: Course
  if (parsed.courseSearch) {
    if (courseLower === parsed.courseSearch) {
      score += 1900; // Exact course match
      matchedFields.push("course");
      primaryMatch = "course";
    } else if (courseLower.startsWith(parsed.courseSearch)) {
      score += 1700;
      matchedFields.push("course");
      primaryMatch = "course";
    } else if (courseLower.includes(parsed.courseSearch)) {
      score += 1400;
      matchedFields.push("course");
      primaryMatch = "course";
    } else {
      const fuzzyScore = fuzzyMatchScore(courseLower, parsed.courseSearch);
      if (fuzzyScore > 0.7) {
        score += fuzzyScore * 350;
        matchedFields.push("course_fuzzy");
        primaryMatch = "course_fuzzy";
      }
    }
  }

  // Field-specific search: Name
  if (parsed.nameSearch) {
    if (nameLower === parsed.nameSearch) {
      score += 1950;
      matchedFields.push("name");
      primaryMatch = "name";
    } else if (nameLower.startsWith(parsed.nameSearch)) {
      score += 1750;
      matchedFields.push("name");
      primaryMatch = "name";
    } else if (nameLower.includes(parsed.nameSearch)) {
      score += 1450;
      matchedFields.push("name");
      primaryMatch = "name";
    } else {
      const fuzzyScore = fuzzyMatchScore(nameLower, parsed.nameSearch);
      if (fuzzyScore > 0.75) {
        score += fuzzyScore * 400;
        matchedFields.push("name_fuzzy");
        primaryMatch = "name_fuzzy";
      }
    }
  }

  // Field-specific search: Roll Number
  if (parsed.rollNoSearch) {
    if (rollNoLower === parsed.rollNoSearch) {
      score += 1850;
      matchedFields.push("rollNo");
      primaryMatch = "rollNo";
    } else if (rollNoLower.startsWith(parsed.rollNoSearch)) {
      score += 1650;
      matchedFields.push("rollNo");
      primaryMatch = "rollNo";
    } else if (rollNoLower.includes(parsed.rollNoSearch)) {
      score += 1350;
      matchedFields.push("rollNo");
      primaryMatch = "rollNo";
    }
  }

  // General search terms (search across all fields)
  if (parsed.generalTerms.length > 0) {
    let anyTermMatched = false;

    for (const term of parsed.generalTerms) {
      // Name matching
      if (nameLower === term) {
        score += 1000;
        if (!matchedFields.includes("name")) matchedFields.push("name");
        if (!primaryMatch) primaryMatch = "name";
        anyTermMatched = true;
      } else if (nameLower.startsWith(term)) {
        score += 800;
        if (!matchedFields.includes("name")) matchedFields.push("name");
        if (!primaryMatch) primaryMatch = "name";
        anyTermMatched = true;
      } else if (nameLower.split(/\s+/).some(part => part.startsWith(term))) {
        score += 750;
        if (!matchedFields.includes("name")) matchedFields.push("name");
        if (!primaryMatch) primaryMatch = "name";
        anyTermMatched = true;
      } else if (nameLower.includes(term)) {
        score += 600;
        if (!matchedFields.includes("name")) matchedFields.push("name");
        if (!primaryMatch) primaryMatch = "name";
        anyTermMatched = true;
      }

      // Course matching (only add if no previous match with higher priority)
      if (courseLower === term) {
        score += 950;
        if (!matchedFields.includes("course")) matchedFields.push("course");
        if (!primaryMatch) primaryMatch = "course";
        anyTermMatched = true;
      } else if (courseLower.startsWith(term)) {
        score += 850;
        if (!matchedFields.includes("course")) matchedFields.push("course");
        if (!primaryMatch) primaryMatch = "course";
        anyTermMatched = true;
      } else if (courseLower.includes(term)) {
        score += 500;
        if (!matchedFields.includes("course")) matchedFields.push("course");
        if (!primaryMatch) primaryMatch = "course";
        anyTermMatched = true;
      }

      // Roll number matching
      if (rollNoLower === term) {
        score += 900;
        if (!matchedFields.includes("rollNo")) matchedFields.push("rollNo");
        if (!primaryMatch) primaryMatch = "rollNo";
        anyTermMatched = true;
      } else if (rollNoLower.startsWith(term)) {
        score += 750;
        if (!matchedFields.includes("rollNo")) matchedFields.push("rollNo");
        if (!primaryMatch) primaryMatch = "rollNo";
        anyTermMatched = true;
      } else if (rollNoLower.includes(term)) {
        score += 450;
        if (!matchedFields.includes("rollNo")) matchedFields.push("rollNo");
        if (!primaryMatch) primaryMatch = "rollNo";
        anyTermMatched = true;
      }

      // ID matching
      if (idLower === term) {
        score += 850;
        if (!matchedFields.includes("id")) matchedFields.push("id");
        if (!primaryMatch) primaryMatch = "id";
        anyTermMatched = true;
      } else if (idLower.startsWith(term)) {
        score += 700;
        if (!matchedFields.includes("id")) matchedFields.push("id");
        if (!primaryMatch) primaryMatch = "id";
        anyTermMatched = true;
      } else if (idLower.includes(term)) {
        score += 400;
        if (!matchedFields.includes("id")) matchedFields.push("id");
        if (!primaryMatch) primaryMatch = "id";
        anyTermMatched = true;
      }

      // Advanced fuzzy matching for partial matches
      if (score === 0 || !anyTermMatched) {
        const nameScore = fuzzyMatchScore(nameLower, term);
        const courseScore = fuzzyMatchScore(courseLower, term);
        const rollNoScore = fuzzyMatchScore(rollNoLower, term);
        const idScore = fuzzyMatchScore(idLower, term);

        const maxFuzzy = Math.max(nameScore, courseScore, rollNoScore, idScore);

        if (maxFuzzy > 0.65) {
          if (maxFuzzy === nameScore && nameScore > 0) {
            score += nameScore * 200;
            if (!matchedFields.includes("name_fuzzy")) matchedFields.push("name_fuzzy");
            if (!primaryMatch) primaryMatch = "name_fuzzy";
          } else if (maxFuzzy === courseScore && courseScore > 0) {
            score += courseScore * 180;
            if (!matchedFields.includes("course_fuzzy")) matchedFields.push("course_fuzzy");
            if (!primaryMatch) primaryMatch = "course_fuzzy";
          } else if (maxFuzzy === rollNoScore && rollNoScore > 0) {
            score += rollNoScore * 180;
            if (!matchedFields.includes("rollNo_fuzzy")) matchedFields.push("rollNo_fuzzy");
            if (!primaryMatch) primaryMatch = "rollNo_fuzzy";
          } else if (maxFuzzy === idScore && idScore > 0) {
            score += idScore * 150;
            if (!matchedFields.includes("id_fuzzy")) matchedFields.push("id_fuzzy");
            if (!primaryMatch) primaryMatch = "id_fuzzy";
          }
          anyTermMatched = true;
        }
      }
    }
  }

  // Status bonus
  if (score > 0 && certificate.status !== "revoked") {
    score += 20;
  }

  // Recency bonus
  if (score > 0 && certificate.createdAt) {
    const daysOld =
      (Date.now() - new Date(certificate.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysOld < 7) score += 30;
    else if (daysOld < 30) score += 15;
  }

  // Determine match type based on primary match quality
  let matchType: SearchScore["matchType"] = "fuzzy";
  if (
    primaryMatch?.includes("exact") ||
    !primaryMatch?.includes("fuzzy") ||
    primaryMatch?.startsWith("name") ||
    primaryMatch?.startsWith("course") ||
    primaryMatch?.startsWith("rollNo") ||
    primaryMatch?.startsWith("id")
  ) {
    matchType = score > 1750 ? "exact" : score > 1200 ? "startsWith" : score > 600 ? "includes" : "fuzzy";
  }

  return {
    certificate,
    score: Math.max(0, score),
    matchType,
    matchedFields,
    primaryMatch,
  };
};

/**
 * Filter certificates based on query with advanced relevance scoring
 * Applies smart filtering ensuring field-specific searches only return relevant results
 */
export const filterCertificatesWithScores = (
  certificates: Certificate[],
  query: string,
  filterStatus?: "all" | "issued" | "revoked"
): SearchScore[] => {
  const queryTrimmed = query.trim();

  if (!queryTrimmed) {
    return [];
  }

  const parsed = parseSearchQuery(queryTrimmed);

  // Apply status filter
  let filtered = certificates;
  if (filterStatus === "issued") {
    filtered = filtered.filter(c => c.status !== "revoked");
  } else if (filterStatus === "revoked") {
    filtered = filtered.filter(c => c.status === "revoked");
  }

  // Calculate scores
  const scored = filtered
    .map(cert => calculateRelevanceScore(cert, queryTrimmed))
    .filter(item => item.score > 0);

  // Apply field-specific result filtering
  // If user searched for specific field, only return results matching that field
  if (parsed.isFieldSpecific) {
    let fieldFiltered = scored;

    if (parsed.courseSearch) {
      // When searching by course, only return certificates with exact or close course match
      fieldFiltered = fieldFiltered.filter(
        item =>
          item.matchedFields.some(f => f.includes("course")) ||
          item.primaryMatch?.includes("course")
      );
    }

    if (parsed.idSearch) {
      // When searching by ID, only return certificates with exact or close ID match
      fieldFiltered = fieldFiltered.filter(
        item =>
          item.matchedFields.some(f => f.includes("id")) ||
          item.primaryMatch?.includes("id")
      );
    }

    if (parsed.nameSearch) {
      // When searching by name, only return certificates with exact or close name match
      fieldFiltered = fieldFiltered.filter(
        item =>
          item.matchedFields.some(f => f.includes("name")) ||
          item.primaryMatch?.includes("name")
      );
    }

    if (parsed.rollNoSearch) {
      // When searching by rollNo, only return certificates with exact or close rollNo match
      fieldFiltered = fieldFiltered.filter(
        item =>
          item.matchedFields.some(f => f.includes("rollNo")) ||
          item.primaryMatch?.includes("rollNo")
      );
    }

    scored.splice(0, scored.length, ...fieldFiltered);
  }

  // Sort by relevance score
  return scored.sort((a, b) => b.score - a.score);
};

/**
 * Generate dynamic search suggestions from certificates
 * Intelligently categorizes and prioritizes suggestions
 */
export const generateSearchSuggestions = (
  certificates: Certificate[],
  query: string,
  limit: number = 3
): { names: SearchSuggestion[]; rollNumbers: SearchSuggestion[]; courses: SearchSuggestion[] } => {
  const queryLower = query.toLowerCase();

  if (!queryLower) {
    return { names: [], rollNumbers: [], courses: [] };
  }

  // Count occurrences of matching names, roll numbers, and courses
  const nameMap = new Map<string, number>();
  const rollNoMap = new Map<string, number>();
  const courseMap = new Map<string, number>();

  certificates.forEach(cert => {
    if (cert.name?.toLowerCase().includes(queryLower)) {
      nameMap.set(cert.name, (nameMap.get(cert.name) || 0) + 1);
    }
    if (cert.rollNo?.toLowerCase().includes(queryLower)) {
      rollNoMap.set(cert.rollNo, (rollNoMap.get(cert.rollNo) || 0) + 1);
    }
    if (cert.course?.toLowerCase().includes(queryLower)) {
      courseMap.set(cert.course, (courseMap.get(cert.course) || 0) + 1);
    }
  });

  // Prioritize by relevance (exact matches first, then starts-with, then includes)
  const prioritizeSuggestions = (
    map: Map<string, number>,
    type: "name" | "rollNo" | "course"
  ): SearchSuggestion[] => {
    const sorted = Array.from(map.entries())
      .sort((a, b) => {
        const aLower = a[0].toLowerCase();
        const bLower = b[0].toLowerCase();

        // Exact match has highest priority
        if (aLower === queryLower && bLower !== queryLower) return -1;
        if (aLower !== queryLower && bLower === queryLower) return 1;

        // Starts-with has second priority
        const aStarts = aLower.startsWith(queryLower);
        const bStarts = bLower.startsWith(queryLower);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        // Then by count
        return b[1] - a[1];
      })
      .slice(0, limit)
      .map(([value, count]) => ({
        type,
        value,
        count,
        emoji: type === "name" ? "📝" : type === "rollNo" ? "🔢" : "📚",
      }));

    return sorted;
  };

  return {
    names: prioritizeSuggestions(nameMap, "name"),
    rollNumbers: prioritizeSuggestions(rollNoMap, "rollNo"),
    courses: prioritizeSuggestions(courseMap, "course"),
  };
};

/**
 * Advanced fuzzy filter using Levenshtein distance for similarity matching
 * Useful as a fallback when exact/prefix matching doesn't find results
 */
export const fuzzyFilterCertificates = (
  certificates: Certificate[],
  query: string,
  maxDistance: number = 2
): Certificate[] => {
  const queryLower = query.toLowerCase();

  return certificates.filter(cert => {
    const nameLower = cert.name?.toLowerCase() || "";
    const rollNoLower = cert.rollNo?.toLowerCase() || "";
    const courseLower = cert.course?.toLowerCase() || "";
    const idLower = cert.id?.toLowerCase() || "";

    // Exact or prefix match wins
    if (
      nameLower.includes(queryLower) ||
      rollNoLower.includes(queryLower) ||
      courseLower.includes(queryLower) ||
      idLower.includes(queryLower)
    ) {
      return true;
    }

    // Levenshtein distance matching
    const nameDistance = levenshteinDistance(nameLower, queryLower);
    const rollDistance = levenshteinDistance(rollNoLower, queryLower);
    const courseDistance = levenshteinDistance(courseLower, queryLower);
    const idDistance = levenshteinDistance(idLower, queryLower);

    return Math.min(nameDistance, rollDistance, courseDistance, idDistance) <= maxDistance;
  });
};
