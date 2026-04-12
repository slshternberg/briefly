/**
 * Structured style profile generated from example pairs.
 * This is stored as JSON and used at runtime in prompts —
 * raw examples are NEVER sent on every request.
 */
export interface StyleProfile {
  analysisPreferences: {
    summaryLength: "short" | "medium" | "detailed";
    emphasizeActionItems: boolean;
    emphasizeObjections: boolean;
    includeClientFriendlySummary: boolean;
    tone: string; // e.g. "professional_warm", "formal_direct", "casual_friendly"
    focusAreas: string[]; // e.g. ["budget", "timeline", "deliverables"]
  };
  emailStyleProfile: {
    formality: "low" | "medium" | "high";
    length: "short" | "medium" | "long";
    openingStyle: string; // e.g. "thanks_after_meeting", "direct_recap"
    closingStyle: string; // e.g. "warm_professional", "action_oriented"
    structure: "paragraphs" | "bullets" | "mixed";
    directness: "soft" | "balanced" | "direct";
    signatureStyle: string; // e.g. "first_name_only", "full_name", "regards"
    samplePhrases: string[]; // characteristic phrases from examples
  };
  generalObservations: string; // free-text notes about the user's style
}

export interface ExampleAnalysis {
  emailTone: string;
  emailStructure: string;
  emailLength: string;
  keyPhrases: string[];
  meetingFocusAreas: string[];
  summaryStyle: string;
}
