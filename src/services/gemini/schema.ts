import { Type, type Schema } from "@google/genai";

/**
 * Structured output schema for conversation analysis.
 * Gemini will return JSON matching this shape.
 */
export const conversationAnalysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    contentType: {
      type: Type.STRING,
      description:
        'Must be either "meeting_analysis" (real business conversation with enough content) or "insufficient_content" (audio lacks meaningful business conversation content — silence, noise, music, very short phrases, or unrelated speech).',
    },
    internalSummary: {
      type: Type.STRING,
      description:
        'A concise internal summary for the business owner. Include key context, outcomes, and internal-only observations. If contentType is "insufficient_content", explain why the audio could not be analyzed.',
    },
    clientFriendlySummary: {
      type: Type.STRING,
      description:
        "A clean, professional summary safe to share with the client. No internal notes, pricing strategy, or negotiation tactics. Empty string if insufficient content.",
    },
    keyTopics: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "Main topics discussed in the conversation. Empty array if insufficient content.",
    },
    decisions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "Decisions made during the conversation. Each should be a clear, actionable statement. Empty array if insufficient content.",
    },
    actionItems: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "Tasks or follow-ups that need to be done. Include who is responsible if mentioned. Empty array if insufficient content.",
    },
    customerObjections: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "Objections, concerns, or pushback raised by the customer or client. Empty array if insufficient content.",
    },
    followUpPromises: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "Promises or commitments made to the client during the conversation. Empty array if insufficient content.",
    },
    openQuestions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "Questions that were raised but not fully answered during the conversation. Empty array if insufficient content.",
    },
    sensitiveInternalNotes: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "Internal-only notes: pricing discussions, negotiation strategy, competitor mentions, or anything not appropriate to share externally. Empty array if insufficient content.",
    },
    suggestedEmailSubject: {
      type: Type.STRING,
      description:
        "A professional email subject line for a follow-up email to the client. Empty string if insufficient content.",
    },
    suggestedEmailBody: {
      type: Type.STRING,
      description:
        "A professional follow-up email body to send to the client, summarizing next steps and commitments. Empty string if insufficient content.",
    },
  },
  required: [
    "contentType",
    "internalSummary",
    "clientFriendlySummary",
    "keyTopics",
    "decisions",
    "actionItems",
    "customerObjections",
    "followUpPromises",
    "openQuestions",
    "sensitiveInternalNotes",
    "suggestedEmailSubject",
    "suggestedEmailBody",
  ],
};

/**
 * TypeScript type matching the schema above.
 */
export interface ConversationAnalysis {
  contentType: "meeting_analysis" | "insufficient_content";
  internalSummary: string;
  clientFriendlySummary: string;
  keyTopics: string[];
  decisions: string[];
  actionItems: string[];
  customerObjections: string[];
  followUpPromises: string[];
  openQuestions: string[];
  sensitiveInternalNotes: string[];
  suggestedEmailSubject: string;
  suggestedEmailBody: string;
}
