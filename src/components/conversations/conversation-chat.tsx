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

      {/* Messages */}
      <div className="max-h-96 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground/60 text-center py-6">
            {labels.noMessages}
          </p>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "USER" ? (rtl ? "justify-start" : "justify-end") : (rtl ? "justify-end" : "justify-start")}`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                msg.role === "USER"
                  ? "bg-primary/20 text-foreground"
                  : "bg-card border border-border text-muted-foreground"
              }`}
              dir="auto"
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className={`flex ${rtl ? "justify-end" : "justify-start"}`}>
            <div className="bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-muted-foreground">
              {labels.thinking}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 rounded-lg bg-destructive/10 border border-destructive/20 p-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-border p-3 flex gap-2">
        <input
          type="text"
          dir="auto"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={labels.askAbout}
          maxLength={2000}
          disabled={loading}
          className="flex-1 rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/80 transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {labels.send}
        </button>
      </form>
    </div>
  );
}
