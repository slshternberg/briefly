import { GoogleGenAI } from "@google/genai";
import {
  conversationAnalysisSchema,
  type ConversationAnalysis,
} from "./schema";
import {
  buildConversationAnalysisPrompt,
  buildAnalysisUserMessage,
} from "@/services/ai/prompts";
import type { StyleProfile } from "@/services/style/types";

// ============================================================================
// Client + model helpers
// ============================================================================

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }
  return new GoogleGenAI({ apiKey });
}

// ============================================================================
// Model fallback — tries models in order, switches immediately on 503
// ============================================================================

const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-2.5-flash-lite";

function isRetriableError(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : String(error);
  return (
    raw.includes("503") ||
    raw.includes("UNAVAILABLE") ||
    raw.includes("high demand") ||
    raw.includes("overloaded") ||
    raw.includes("fetch failed") ||
    raw.includes("timeout") ||
    raw.includes("Timeout") ||
    raw.includes("TIMEOUT") ||
    raw.includes("UND_ERR")
  );
}

async function withModelFallback<T>(
  fn: (model: string) => Promise<T>
): Promise<{ result: T; modelUsed: string }> {
  // Try primary model first
  try {
    const result = await fn(PRIMARY_MODEL);
    return { result, modelUsed: PRIMARY_MODEL };
  } catch (error) {
    if (!isRetriableError(error)) throw error;
    console.warn(`Gemini primary model overloaded → switching to ${FALLBACK_MODEL}`);
  }

  // Fallback model — one retry with delay if also overloaded
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await fn(FALLBACK_MODEL);
      return { result, modelUsed: FALLBACK_MODEL };
    } catch (error) {
      if (!isRetriableError(error) || attempt === 1) throw error;
      console.warn(`Fallback model overloaded — waiting 10s before retry...`);
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }

  throw new Error("Unreachable");
}

// ============================================================================
// Audio analysis
// ============================================================================

export interface StyleExampleForPrompt {
  title: string;
  emailSubject: string;
  emailBody: string;
}

export interface AnalyzeAudioParams {
  filePath: string;
  mimeType: string;
  outputLanguage: string;
  userInstructions?: string;
  customPrompt?: string; // workspace custom prompt for custom_summary
  styleProfile?: StyleProfile | null;
  styleExamples?: StyleExampleForPrompt[]; // actual email examples for few-shot style matching
}

export interface AnalyzeAudioResult {
  analysis: ConversationAnalysis;
  customSummary: string | null;
  rawResponse: string;
  rawCustomResponse: string | null;
  modelUsed: string;
  promptTokens: number | null;
  outputTokens: number | null;
}

/**
 * Uploads audio to Gemini Files API and waits until it's ready.
 * Returns the file metadata needed for subsequent calls.
 */
async function uploadAndWaitForFile(
  ai: GoogleGenAI,
  filePath: string,
  mimeType: string
) {
  const uploadedFile = await ai.files.upload({
    file: filePath,
    config: { mimeType },
  });

  if (!uploadedFile.name) {
    throw new Error("File upload failed: no file name returned");
  }

  let file = uploadedFile;
  let attempts = 0;
  while (file.state === "PROCESSING" && attempts < 30) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    file = await ai.files.get({ name: uploadedFile.name! });
    attempts++;
  }

  if (file.state === "FAILED") {
    throw new Error("File processing failed on Gemini side");
  }

  return { file, fileName: uploadedFile.name! };
}

export async function analyzeConversationAudio(
  params: AnalyzeAudioParams
): Promise<AnalyzeAudioResult> {
  const ai = getClient();

  // Step 1: Upload audio file once
  const { file, fileName } = await uploadAndWaitForFile(
    ai,
    params.filePath,
    params.mimeType
  );

  const fileDataPart = {
    fileData: {
      fileUri: file.uri!,
      mimeType: params.mimeType,
    },
  };

  // -----------------------------------------------------------------------
  // Call 1: General structured analysis (existing behavior, unchanged)
  // -----------------------------------------------------------------------
  const systemInstruction = buildConversationAnalysisPrompt({
    outputLanguage: params.outputLanguage,
    userInstructions: params.userInstructions,
    styleProfile: params.styleProfile,
  });

  const { result: response, modelUsed } = await withModelFallback((model) =>
    ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [fileDataPart, { text: buildAnalysisUserMessage() }],
        },
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: conversationAnalysisSchema,
        temperature: 0.2,
      },
    })
  );

  const rawResponse = response.text ?? "";

  let analysis: ConversationAnalysis;
  try {
    analysis = JSON.parse(rawResponse);
  } catch {
    throw new Error(
      `Failed to parse Gemini response as JSON: ${rawResponse.slice(0, 200)}`
    );
  }

  if (!analysis.contentType) {
    analysis.contentType = "meeting_analysis";
  }

  if (analysis.contentType === "meeting_analysis" && !analysis.internalSummary) {
    throw new Error(
      "Gemini response missing required field: internalSummary"
    );
  }

  // Ensure arrays default to empty
  analysis.keyTopics = analysis.keyTopics ?? [];
  analysis.decisions = analysis.decisions ?? [];
  analysis.actionItems = analysis.actionItems ?? [];
  analysis.customerObjections = analysis.customerObjections ?? [];
  analysis.followUpPromises = analysis.followUpPromises ?? [];
  analysis.openQuestions = analysis.openQuestions ?? [];
  analysis.sensitiveInternalNotes = analysis.sensitiveInternalNotes ?? [];
  analysis.suggestedEmailSubject = analysis.suggestedEmailSubject ?? "";
  analysis.suggestedEmailBody = analysis.suggestedEmailBody ?? "";

  const usage = response.usageMetadata;
  let totalPromptTokens = usage?.promptTokenCount ?? null;
  let totalOutputTokens = usage?.candidatesTokenCount ?? null;

  // -----------------------------------------------------------------------
  // Call 2: Custom summary (ONLY if customPrompt is provided)
  // Uses the SAME uploaded audio file — independent from general analysis
  // -----------------------------------------------------------------------
  let customSummary: string | null = null;
  let rawCustomResponse: string | null = null;

  if (params.customPrompt && params.customPrompt.trim()) {
    // -----------------------------------------------------------------------
    // Build the custom system instruction using few-shot style matching.
    // Priority: actual email examples (few-shot) > abstract style profile.
    // -----------------------------------------------------------------------

    // Block 1: Few-shot examples — the most powerful style signal.
    // We show Gemini REAL emails the user wrote so it learns style from concrete evidence.
    let fewShotBlock = "";
    if (params.styleExamples && params.styleExamples.length > 0) {
      const exampleTexts = params.styleExamples
        .map(
          (ex, i) =>
            `--- Example ${i + 1}: ${ex.title} ---\nSubject: ${ex.emailSubject}\n\n${ex.emailBody}`
        )
        .join("\n\n");

      fewShotBlock = `

STYLE LEARNING — REAL EMAILS I WROTE AFTER BUSINESS CONVERSATIONS:
Study these examples with extreme care. Every output you produce MUST match this writing style precisely.
Mirror the vocabulary, sentence length, formality, paragraph structure, tone, opening line, closing line, and any recurring phrases.

${exampleTexts}

---
STYLE RULES:
- Do NOT copy the content of these examples — only their writing style.
- If the examples include a signature, reproduce it exactly.
- The output must read as if the user wrote it themselves, not as a template.`;
    }

    // Block 2: Abstract style profile — reinforces consistent patterns across ALL examples.
    // Used as a secondary layer even when few-shot examples are present.
    let styleProfileBlock = "";
    if (params.styleProfile) {
      const sp = params.styleProfile;
      styleProfileBlock = `

CONFIRMED STYLE PATTERNS (consistent across all past examples):
- Tone: ${sp.analysisPreferences.tone}
- Formality: ${sp.emailStyleProfile.formality}
- Length preference: ${sp.emailStyleProfile.length}
- Structure: ${sp.emailStyleProfile.structure}
- Opening pattern: ${sp.emailStyleProfile.openingStyle}
- Closing pattern: ${sp.emailStyleProfile.closingStyle}
- Directness level: ${sp.emailStyleProfile.directness}
- Signature style: ${sp.emailStyleProfile.signatureStyle}
${sp.emailStyleProfile.samplePhrases.length > 0 ? `- Recurring phrases to incorporate naturally: ${sp.emailStyleProfile.samplePhrases.join("; ")}` : ""}
${sp.generalObservations ? `- General observations: ${sp.generalObservations}` : ""}`;
    }

    const customSystemInstruction = `You are a business assistant analyzing an audio recording of a business conversation.
Your task is to generate an output based on the user's custom instructions below.
${fewShotBlock}
${styleProfileBlock}

STRICT RULES:
- Answer ONLY in ${params.outputLanguage}.
- Base your response STRICTLY on what was actually said in the audio. Do NOT hallucinate or invent anything.
- If the audio lacks enough content to fulfill the request, say so clearly.
- Do NOT explain what you are doing. Produce the output directly.
- Do NOT mention the style profile or examples in your output.

USER'S CUSTOM INSTRUCTIONS:
${params.customPrompt}`;

    try {
      const { result: customResponse } = await withModelFallback((model) =>
        ai.models.generateContent({
          model,
          contents: [
            {
              role: "user",
              parts: [
                fileDataPart,
                {
                  text: "Analyze this audio recording according to the custom instructions provided in your system prompt. Respond based ONLY on what was actually said.",
                },
              ],
            },
          ],
          config: {
            systemInstruction: customSystemInstruction,
            temperature: 0.3,
            maxOutputTokens: 10000,
          },
        })
      );

      rawCustomResponse = customResponse.text ?? "";
      customSummary = rawCustomResponse;

      // Accumulate token usage
      const customUsage = customResponse.usageMetadata;
      if (customUsage?.promptTokenCount && totalPromptTokens !== null) {
        totalPromptTokens += customUsage.promptTokenCount;
      }
      if (customUsage?.candidatesTokenCount && totalOutputTokens !== null) {
        totalOutputTokens += customUsage.candidatesTokenCount;
      }
    } catch (err) {
      // Custom summary failure should NOT fail the entire analysis
      console.error("Custom summary generation failed:", err);
      customSummary = null;
      rawCustomResponse = null;
    }
  }

  // Step: Clean up uploaded file (best-effort, AFTER both calls)
  ai.files.delete({ name: fileName }).catch((err) => {
    console.warn(`Failed to clean up Gemini file ${fileName}:`, err);
  });

  return {
    analysis,
    customSummary,
    rawResponse,
    rawCustomResponse,
    modelUsed,
    promptTokens: totalPromptTokens,
    outputTokens: totalOutputTokens,
  };
}

// ============================================================================
// Chat (no audio — uses summary data only)
// ============================================================================

export interface ChatParams {
  systemInstruction: string;
  contents: { role: string; parts: { text: string }[] }[];
}

export interface ChatResult {
  response: string;
  modelUsed: string;
  promptTokens: number | null;
  outputTokens: number | null;
}

export async function chatWithConversation(
  params: ChatParams
): Promise<ChatResult> {
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: PRIMARY_MODEL,
    contents: params.contents,
    config: {
      systemInstruction: params.systemInstruction,
      temperature: 0.4,
      maxOutputTokens: 1024,
    },
  });

  const text = response.text ?? "";
  const usage = response.usageMetadata;

  return {
    response: text,
    modelUsed: PRIMARY_MODEL,
    promptTokens: usage?.promptTokenCount ?? null,
    outputTokens: usage?.candidatesTokenCount ?? null,
  };
}
