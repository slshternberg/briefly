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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const q = question.trim();
    if (!q || loading) return;

    setError("");
    setLoading(true);
    setQuestion("");

    // Auto-reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "USER",
      content: q,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch(`/api/conversations/${conversationId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, outputLanguage, threadId }),
      });

      const data = await res.json() as {
        error?: string;
        threadId?: string;
        userMessage?: ChatMessage;
        assistantMessage?: ChatMessage;
      };

      if (!res.ok) {
        setError(data.error || (rtl ? "משהו השתבש. נסי שנית." : "Something went wrong. Please try again."));
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
        setQuestion(q);
        return;
      }

      setThreadId(data.threadId);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMsg.id),
        data.userMessage!,
        data.assistantMessage!,
      ]);
    } catch {
      setError(rtl ? "שגיאת רשת. נסי שנית." : "Network error. Please try again.");
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      setQuestion(q);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden flex flex-col" dir={rtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="bg-card/80 px-5 py-3 border-b border-border">
        <h2 className="font-semibold">{labels.aiChat}</h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[400px]">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">
              {rtl ? "שאלי שאלות על תוכן השיחה" : "Ask questions about the conversation"}
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "USER" ? (rtl ? "justify-start" : "justify-end") : (rtl ? "justify-end" : "justify-start")}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                msg.role === "USER"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-foreground"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className={`flex ${rtl ? "justify-end" : "justify-start"}`}>
            <div className="bg-muted/60 rounded-2xl px-4 py-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 text-xs text-destructive bg-destructive/5 border-t border-destructive/20">
          {error}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-border p-3 flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={question}
          onChange={(e) => {
            setQuestion(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
          }}
          onKeyDown={handleKeyDown}
          disabled={loading}
          rows={1}
          dir="auto"
          placeholder={rtl ? "שאלי שאלה על השיחה..." : "Ask a question about the conversation..."}
          className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition disabled:opacity-50 overflow-hidden"
          style={{ minHeight: "40px", maxHeight: "120px" }}
        />
        <button
          type="submit"
          disabled={!question.trim() || loading}
          className="shrink-0 w-9 h-9 rounded-xl brand-gradient text-white flex items-center justify-center transition-all hover:scale-[1.05] disabled:opacity-40 disabled:hover:scale-100"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={rtl ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} />
          </svg>
        </button>
      </form>
    </div>
  );
}
