import type { ConversationAnalysis } from "@/services/gemini/schema";

export interface ChatPromptParams {
  outputLanguage: string;
  summaryData: ConversationAnalysis;
  chatHistory: { role: "user" | "assistant"; content: string }[];
  userQuestion: string;
}

export function buildConversationChatPrompt(
  params: ChatPromptParams
): { systemInstruction: string; contents: { role: string; parts: { text: string }[] }[] } {
  const { outputLanguage, summaryData, chatHistory, userQuestion } = params;

  const systemInstruction = `You are a smart business assistant. You answer questions about a specific business conversation based ONLY on the provided summary and structured data below.

STRICT RULES:
- Answer ONLY in ${outputLanguage}.
- You do NOT have access to the original audio recording.
- Base your answers ONLY on the provided data — do NOT hallucinate or invent missing information.
- If the user asks about something not covered in the data, say so clearly and honestly.
- Prefer short, helpful, and direct answers.
- Maintain a natural conversational tone in ${outputLanguage}.
- You may refer to specific action items, decisions, or topics by quoting them from the data.

CONVERSATION DATA:
---
Internal Summary: ${summaryData.internalSummary}

Client-Friendly Summary: ${summaryData.clientFriendlySummary}

Key Topics: ${summaryData.keyTopics.join(", ") || "None"}

Decisions: ${summaryData.decisions.join("; ") || "None"}

Action Items: ${summaryData.actionItems.join("; ") || "None"}

Customer Objections: ${summaryData.customerObjections.join("; ") || "None"}

Follow-Up Promises: ${summaryData.followUpPromises.join("; ") || "None"}

Open Questions: ${summaryData.openQuestions.join("; ") || "None"}

Sensitive Internal Notes: ${summaryData.sensitiveInternalNotes.join("; ") || "None"}
---`;

  // Build message history
  const contents: { role: string; parts: { text: string }[] }[] = [];

  for (const msg of chatHistory) {
    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    });
  }

  // Add the current user question
  contents.push({
    role: "user",
    parts: [{ text: userQuestion }],
  });

  return { systemInstruction, contents };
}
