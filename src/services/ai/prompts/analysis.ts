import type { StyleProfile } from "@/services/style/types";

export interface AnalysisPromptParams {
  outputLanguage: string;
  userInstructions?: string;
  styleProfile?: StyleProfile | null;
}

export function buildConversationAnalysisPrompt(
  params: AnalysisPromptParams
): string {
  const { outputLanguage, userInstructions, styleProfile } = params;

  const base = `You are an expert business meeting analyst. Your job is to analyze audio recordings of business conversations and produce structured, actionable intelligence for the business owner.

CRITICAL ANTI-HALLUCINATION RULES:
- You MUST rely ONLY on content that is ACTUALLY SPOKEN in the audio.
- NEVER hallucinate, invent, assume, or generate information that is not explicitly present in the audio.
- If something was not said, do NOT include it. Leave the field as an empty string or empty array.
- Do NOT infer meetings, participants, decisions, or topics that were not explicitly discussed.
- Do NOT create fictional summaries or fabricate context.

INSUFFICIENT CONTENT RULE:
- If the audio does NOT contain a real business conversation (e.g., it is silence, noise, music, a single word, just names, or unrelated speech), you MUST return:
  - Set the "contentType" field to "insufficient_content"
  - Set "internalSummary" to a brief explanation of why the content is insufficient (in ${outputLanguage})
  - Set ALL other string fields to empty strings
  - Set ALL array fields to empty arrays
- If the audio DOES contain a real business conversation, set "contentType" to "meeting_analysis" and fill all fields based ONLY on what was actually said.

STRICT OUTPUT LANGUAGE RULE:
- The audio may be in ANY language.
- Your entire output MUST be written ONLY in ${outputLanguage}.
- Do NOT translate word-by-word — adapt naturally to ${outputLanguage}.
- Field names remain in English (they are JSON keys), but all VALUES must be in ${outputLanguage}.

ANALYSIS GUIDELINES (apply ONLY when contentType is "meeting_analysis"):
- Listen carefully to the entire conversation
- Distinguish between internal information (for the business owner only) and client-safe information
- Be concise but thorough — every field should contain useful information
- Action items should be specific and include responsible parties when mentioned
- The client-facing summary must be professional and never reveal internal strategy, pricing, or negotiation tactics
- The suggested follow-up email should be ready to send with minimal editing
- If the audio is unclear or partially inaudible, note this in the internal summary
- If a field has no relevant content, return an empty array or empty string — do NOT fabricate information
- Maintain a professional business tone throughout`;

  const parts = [base];

  if (styleProfile) {
    parts.push(`STYLE PROFILE (learned from the user's past communication patterns):
- Summary length preference: ${styleProfile.analysisPreferences.summaryLength}
- Emphasize action items: ${styleProfile.analysisPreferences.emphasizeActionItems}
- Emphasize objections: ${styleProfile.analysisPreferences.emphasizeObjections}
- Preferred tone: ${styleProfile.analysisPreferences.tone}
- Focus areas: ${styleProfile.analysisPreferences.focusAreas.join(", ") || "none specified"}
- Email formality: ${styleProfile.emailStyleProfile.formality}
- Email length: ${styleProfile.emailStyleProfile.length}
- Email structure: ${styleProfile.emailStyleProfile.structure}
- Email opening style: ${styleProfile.emailStyleProfile.openingStyle}
- Email closing style: ${styleProfile.emailStyleProfile.closingStyle}
- Email directness: ${styleProfile.emailStyleProfile.directness}
- Signature style: ${styleProfile.emailStyleProfile.signatureStyle}
- Characteristic phrases to incorporate: ${styleProfile.emailStyleProfile.samplePhrases.join("; ") || "none"}

Apply these style preferences to the output — especially the suggested follow-up email. The style profile reflects the user's actual writing patterns, so match them naturally.`);
  }

  if (userInstructions) {
    parts.push(`ADDITIONAL USER INSTRUCTIONS:
${userInstructions}`);
  }

  return parts.join("\n\n");
}

export function buildAnalysisUserMessage(): string {
  return `Analyze this audio recording. First determine if it contains a real business conversation with enough content for meaningful analysis.

If it does NOT (silence, noise, music, just names, very short phrases, or unrelated content), set contentType to "insufficient_content" and explain why.

If it DOES contain a real business conversation, set contentType to "meeting_analysis" and extract all relevant information according to the output schema. Base your analysis STRICTLY on what was actually said — do not invent or assume anything.`;
}
