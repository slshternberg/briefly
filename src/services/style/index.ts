import { db } from "@/lib/db";
import { getStorageProvider } from "@/services/storage";
import type { StyleProfile } from "./types";
import { GoogleGenAI } from "@google/genai";

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  return new GoogleGenAI({ apiKey });
}

function getModel(): string {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash-preview-05-20";
}

/**
 * Process a single style example:
 * - Upload audio to Gemini
 * - Send audio + sent email to Gemini
 * - Extract per-example style observations
 * - Store them on the StyleExample record
 */
export async function processStyleExample(exampleId: string, workspaceId: string) {
  const example = await db.styleExample.findFirst({
    where: { id: exampleId, workspaceId },
  });

  if (!example) throw new Error("Style example not found");

  await db.styleExample.update({
    where: { id: exampleId },
    data: { status: "PROCESSING" },
  });

  try {
    const ai = getClient();
    const model = getModel();
    const storage = getStorageProvider();
    const filePath = storage.getFilePath(example.audioStoragePath);

    // Upload audio
    const uploadedFile = await ai.files.upload({
      file: filePath,
      config: { mimeType: example.audioMimeType },
    });

    if (!uploadedFile.name) throw new Error("File upload failed");

    // Wait for file readiness
    let file = uploadedFile;
    let attempts = 0;
    while (file.state === "PROCESSING" && attempts < 30) {
      await new Promise((r) => setTimeout(r, 2000));
      file = await ai.files.get({ name: uploadedFile.name! });
      attempts++;
    }

    if (file.state === "FAILED") throw new Error("File processing failed");

    // Analyze the example pair
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            {
              fileData: {
                fileUri: file.uri!,
                mimeType: example.audioMimeType,
              },
            },
            {
              text: `I'm analyzing a business conversation and the follow-up email that was sent afterward.

Here is the email that was sent after this conversation:

Subject: ${example.sentEmailSubject}

Body:
${example.sentEmailBody}

---

Analyze the RELATIONSHIP between this conversation and the email that followed. Return a JSON object with these fields:

{
  "emailTone": "description of the email tone (e.g. warm_professional, formal, casual)",
  "emailStructure": "paragraphs | bullets | mixed",
  "emailLength": "short | medium | long",
  "emailFormality": "low | medium | high",
  "emailDirectness": "soft | balanced | direct",
  "openingStyle": "how the email opens (e.g. thanks_after_meeting, direct_recap)",
  "closingStyle": "how the email closes (e.g. warm_professional, action_oriented)",
  "keyPhrases": ["characteristic phrases or patterns used"],
  "meetingFocusAreas": ["what aspects of the meeting the email focused on"],
  "summaryStyle": "how the meeting content was summarized in the email",
  "signatureStyle": "how the email is signed off"
}

Return ONLY valid JSON. Base your analysis STRICTLY on the actual audio and email content.`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const rawText = response.text ?? "";
    let extractedProfile;
    try {
      extractedProfile = JSON.parse(rawText);
    } catch {
      throw new Error("Failed to parse style analysis: " + rawText.slice(0, 200));
    }

    // Clean up file
    ai.files.delete({ name: uploadedFile.name! }).catch(() => {});

    await db.styleExample.update({
      where: { id: exampleId },
      data: {
        status: "COMPLETED",
        extractedProfile,
      },
    });

    return extractedProfile;
  } catch (err) {
    await db.styleExample.update({
      where: { id: exampleId },
      data: { status: "FAILED" },
    });
    throw err;
  }
}

/**
 * Generate a merged StyleProfile from all completed examples.
 * This runs ONCE and the result is stored — raw examples are never
 * sent on every analysis request.
 */
export async function generateStyleProfile(workspaceId: string): Promise<StyleProfile> {
  const examples = await db.styleExample.findMany({
    where: { workspaceId, status: "COMPLETED" },
    select: { extractedProfile: true, title: true },
    orderBy: { createdAt: "desc" },
    take: 20, // Limit to 20 most recent examples
  });

  if (examples.length === 0) {
    throw new Error("No completed style examples found. Process at least one example first.");
  }

  const ai = getClient();
  const model = getModel();

  const exampleSummaries = examples.map((e, i) =>
    `Example ${i + 1} (${e.title}):\n${JSON.stringify(e.extractedProfile, null, 2)}`
  ).join("\n\n---\n\n");

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `I have analyzed ${examples.length} pairs of business conversations and the follow-up emails that were sent afterward. Below are the extracted style observations from each pair.

${exampleSummaries}

---

Based on ALL these examples, generate a MERGED style profile that captures the user's consistent patterns and preferences. Return a JSON object with this exact structure:

{
  "analysisPreferences": {
    "summaryLength": "short" | "medium" | "detailed",
    "emphasizeActionItems": true/false,
    "emphasizeObjections": true/false,
    "includeClientFriendlySummary": true/false,
    "tone": "description of preferred tone",
    "focusAreas": ["areas the user consistently focuses on"]
  },
  "emailStyleProfile": {
    "formality": "low" | "medium" | "high",
    "length": "short" | "medium" | "long",
    "openingStyle": "consistent opening pattern",
    "closingStyle": "consistent closing pattern",
    "structure": "paragraphs" | "bullets" | "mixed",
    "directness": "soft" | "balanced" | "direct",
    "signatureStyle": "consistent sign-off style",
    "samplePhrases": ["characteristic phrases the user tends to use"]
  },
  "generalObservations": "Free-text summary of the user's overall communication style and preferences"
}

Return ONLY valid JSON. Identify CONSISTENT patterns across all examples — ignore one-off variations.`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const rawText = response.text ?? "";
  let profile: StyleProfile;
  try {
    profile = JSON.parse(rawText);
  } catch {
    throw new Error("Failed to parse style profile: " + rawText.slice(0, 200));
  }

  // Deactivate old profiles
  await db.styleProfile.updateMany({
    where: { workspaceId, isActive: true },
    data: { isActive: false },
  });

  // Store new profile
  const saved = await db.styleProfile.create({
    data: {
      workspaceId,
      version: (await db.styleProfile.count({ where: { workspaceId } })) + 1,
      profileJson: profile as object,
      generatedFromExampleCount: examples.length,
      isActive: true,
    },
  });

  // Update workspace pointer
  await db.workspace.update({
    where: { id: workspaceId },
    data: { activeStyleProfileId: saved.id },
  });

  return profile;
}

/**
 * Load the active style profile for a workspace.
 * Returns null if no profile exists.
 */
export async function getActiveStyleProfile(workspaceId: string): Promise<StyleProfile | null> {
  const profile = await db.styleProfile.findFirst({
    where: { workspaceId, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  if (!profile) return null;
  return profile.profileJson as unknown as StyleProfile;
}
