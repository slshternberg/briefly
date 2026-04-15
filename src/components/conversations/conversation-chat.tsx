"use client";

import { useState, useRef, useEffect } from "react";
import { getLabels, isRTL } from "@/lib/ui-labels";

interface ChatMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string;
}

interface ConversationChatProps {
  conversationId: string;
  initialMessages?: ChatMessage[];
  initialThreadId?: string;
  outputLanguage: string;
}

export function ConversationChat({
  conversationId,
  initialMessages = [],
  initialThreadId,
  outputLanguage,
}: ConversationChatProps) {
  const labels = getLabels(outputLanguage);
  const rtl = isRTL(outputLanguage);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [threadId, setThreadId] = useState<string | undefined>(initialThreadId);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;

    setError("");
    setLoading(true);
    setQuestion("");

    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "USER",
      content: q,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: q,
            outputLanguage,
            threadId,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Chat failed");
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
        setQuestion(q);
        setLoading(false);
        return;
      }

      setThreadId(data.threadId);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMsg.id),
        data.userMessage,
        data.assistantMessage,
      ]);
    } catch {
      setError("Something went wrong. Please try again.");
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      setQuestion(q);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="bg-card/80 px-5 py-3 border-b border-border">
        <h2 className="font-semibold">{labels.aiChat}</h2>
      </div>

      {/* Coming soon overlay */}
      <div className="p-10 flex flex-col items-center justify-center gap-3 text-center">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
          </svg>
        </div>
        <p className="text-sm font-medium">{rtl ? "הפיצ׳ר בבנייה" : "Feature in development"}</p>
        <p className="text-xs text-muted-foreground">{rtl ? "תודה על הסבלנות 🙏" : "Thank you for your patience 🙏"}</p>
      </div>
    </div>
  );
}
