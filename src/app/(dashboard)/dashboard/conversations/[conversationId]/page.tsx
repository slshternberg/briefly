import { requireAuth } from "@/lib/auth-guard";
import { getConversation } from "@/services/conversation";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ProcessButton } from "@/components/conversations/process-button";
import { ConversationChat } from "@/components/conversations/conversation-chat";
import { DraftUpload } from "@/components/conversations/draft-upload";
import { DeleteButton } from "@/components/conversations/delete-button";
import { EditableTitle } from "@/components/conversations/editable-title";
import { SendEmailButton } from "@/components/conversations/send-email-button";
import { CopyButton } from "@/components/conversations/copy-button";
import { ExportPdfButton } from "@/components/conversations/export-pdf-button";
import type { ConversationAnalysis } from "@/services/gemini/schema";
import { db } from "@/lib/db";
import { getLabels, isRTL } from "@/lib/ui-labels";
import { calculateGeminiCost } from "@/services/gmail";
import { Download } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  UPLOADED: "bg-blue-500/10 text-blue-400",
  PROCESSING: "bg-yellow-500/10 text-yellow-400",
  COMPLETED: "bg-green-500/10 text-green-400",
  FAILED: "bg-destructive/10 text-destructive",
};

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { session, workspace } = await requireAuth();
  const { conversationId } = await params;

  const conversation = await getConversation({
    conversationId,
    workspaceId: workspace.id,
  });

  if (!conversation) {
    notFound();
  }

  const lang = workspace.defaultLanguage || "English";
  const labels = getLabels(lang);
  const rtl = isRTL(lang);
  const statusColor = STATUS_COLORS[conversation.status] || STATUS_COLORS.DRAFT;
  const statusLabel = conversation.status.charAt(0) + conversation.status.slice(1).toLowerCase();
  const asset = conversation.assets[0];
  const rawData = conversation.summary?.structuredData as
    | (ConversationAnalysis & { customSummary?: string | null })
    | null;
  const analysis = rawData;
  const customSummary = rawData?.customSummary ?? null;

  const currentUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { googleEmail: true },
  });
  const isGoogleConnected = !!currentUser?.googleEmail;

  const analysisCost = conversation.summary
    ? calculateGeminiCost(
        conversation.summary.modelUsed ?? "",
        conversation.summary.promptTokens,
        conversation.summary.outputTokens
      )
    : null;

  // Load chat messages
  let initialMessages: { id: string; role: "USER" | "ASSISTANT"; content: string; createdAt: string }[] = [];
  let initialThreadId: string | undefined;

  if (analysis) {
    const thread = await db.chatThread.findFirst({
      where: { conversationId, workspaceId: workspace.id },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 50,
          select: { id: true, role: true, content: true, createdAt: true },
        },
      },
    });

    if (thread) {
      initialThreadId = thread.id;
      initialMessages = thread.messages.map((m) => ({
        id: m.id,
        role: m.role as "USER" | "ASSISTANT",
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      }));
    }
  }

  return (
    <div className="max-w-3xl" dir={rtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground hover:text-foreground transition flex items-center gap-1"
        >
          {rtl ? "→" : "←"} {labels.back}
        </Link>
        <div className="flex items-center gap-2">
          <DeleteButton conversationId={conversation.id} />
        </div>
      </div>

      {/* Title + status */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="min-w-0 flex-1">
          <EditableTitle
            conversationId={conversation.id}
            initialTitle={conversation.title}
          />
          <p className="text-sm text-muted-foreground mt-1">
            {labels.createdOn}
            {new Date(conversation.createdAt).toLocaleDateString(rtl ? "he-IL" : "en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {conversation.createdBy.name
              ? `${labels.by}${conversation.createdBy.name}`
              : ""}
          </p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      {/* Fix #1: Upload zone for DRAFT conversations */}
      {conversation.status === "DRAFT" && (
        <div className="mb-6">
          <DraftUpload conversationId={conversation.id} />
        </div>
      )}

      {/* Audio section */}
      {asset && (
        <div className="rounded-xl border border-border bg-card/60 p-5 mb-6">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-semibold">{labels.audio}</h2>
            <a
              href={`/api/conversations/${conversation.id}/audio?download=1`}
              download={asset.originalName}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <Download className="size-3.5" />
              {rtl ? "הורד הקלטה" : "Download recording"}
            </a>
          </div>
          <div className="text-sm text-muted-foreground mb-3 flex flex-wrap gap-x-4 gap-y-1">
            <span>
              {asset.sourceType === "RECORDED" ? labels.recorded : labels.uploaded}
            </span>
            <span>{asset.originalName}</span>
            <span>
              {(Number(asset.sizeBytes) / (1024 * 1024)).toFixed(1)} MB
            </span>
          </div>
          <audio
            controls
            src={`/api/conversations/${conversation.id}/audio`}
            className="w-full"
          />
        </div>
      )}

      {/* Process / Reanalyze button (Fix #5: also show for COMPLETED) */}
      {conversation.status !== "DRAFT" && (
        <div className="mb-6">
          <ProcessButton
            conversationId={conversation.id}
            status={conversation.status}
            defaultLanguage={lang}
            labels={{
              analyze: labels.analyze,
              reanalyze: labels.reanalyze,
              analyzing: labels.analyzing,
              retry: labels.retryAnalysis,
              addInstructions: labels.addInstructions,
              hideInstructions: labels.hideInstructions,
              instructionsPlaceholder: labels.instructionsPlaceholder,
              tip: labels.analysisTip,
              processingFailed: labels.processingFailed,
              somethingWentWrong: labels.somethingWentWrong,
            }}
          />
        </div>
      )}

      {/* Insufficient content warning */}
      {analysis && analysis.contentType === "insufficient_content" && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-6">
          <h2 className="font-semibold mb-2 text-yellow-400">{labels.insufficientContent}</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {analysis.internalSummary}
          </p>
        </div>
      )}

      {/* Analysis results */}
      {analysis && analysis.contentType !== "insufficient_content" && (
        <div className="space-y-5">

          {/* Export PDF */}
          <div className="flex justify-end">
            <ExportPdfButton
              title={conversation.title}
              rtl={rtl}
              sections={[
                ...(customSummary ? [{ heading: labels.customSummaryTitle, content: customSummary }] : []),
                { heading: labels.internalSummary, content: analysis.internalSummary },
                { heading: labels.clientSummary, content: analysis.clientFriendlySummary },
                { heading: labels.keyTopics, content: analysis.keyTopics.join("\n") },
                { heading: labels.decisions, content: analysis.decisions.join("\n") },
                { heading: labels.actionItems, content: analysis.actionItems.join("\n") },
                { heading: labels.objections, content: analysis.customerObjections.join("\n") },
                { heading: labels.followUpPromises, content: analysis.followUpPromises.join("\n") },
                { heading: labels.openQuestions, content: analysis.openQuestions.join("\n") },
              ]}
            />
          </div>

          {/* Custom Summary — FIRST: this is the primary output the user cares about */}
          {customSummary && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-4">
                <h2 className="font-semibold text-primary text-base">{labels.customSummaryTitle}</h2>
                <div className="flex items-center gap-2 shrink-0">
                  <CopyButton text={customSummary} />
                  <SendEmailButton
                    conversationId={conversationId}
                    subject={conversation.title}
                    body={customSummary}
                    isGoogleConnected={isGoogleConnected}
                  />
                </div>
              </div>
              <div className="text-sm leading-relaxed whitespace-pre-wrap">
                {customSummary}
              </div>
            </div>
          )}

          <AnalysisSection title={labels.internalSummary} copyText={analysis.internalSummary}>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {analysis.internalSummary}
            </p>
          </AnalysisSection>

          <AnalysisSection title={labels.clientSummary} copyText={analysis.clientFriendlySummary}>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {analysis.clientFriendlySummary}
            </p>
          </AnalysisSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ListSection title={labels.keyTopics} items={analysis.keyTopics} empty={labels.noneIdentified} />
            <ListSection title={labels.decisions} items={analysis.decisions} empty={labels.noneIdentified} />
          </div>

          <ListSection title={labels.actionItems} items={analysis.actionItems} empty={labels.noneIdentified} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ListSection title={labels.objections} items={analysis.customerObjections} empty={labels.noneIdentified} />
            <ListSection title={labels.followUpPromises} items={analysis.followUpPromises} empty={labels.noneIdentified} />
          </div>

          <ListSection title={labels.openQuestions} items={analysis.openQuestions} empty={labels.noneIdentified} />

          {analysis.sensitiveInternalNotes.length > 0 && (
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5">
              <h2 className="font-semibold mb-3 text-yellow-400">
                {labels.internalNotes}
              </h2>
              <ul className="space-y-1.5">
                {analysis.sensitiveInternalNotes.map((note, i) => (
                  <li key={i} className="text-sm text-yellow-200/80 flex gap-2">
                    <span className="shrink-0">&bull;</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggested email — only shown when there is no custom summary.
              When custom summary exists, it replaces this section entirely. */}
          {!customSummary && analysis.suggestedEmailSubject && (
            <AnalysisSection title={labels.followUpEmail}>
              <div className="text-sm mb-2">
                <span className="font-medium text-muted-foreground">{labels.emailSubject} </span>
                <span>{analysis.suggestedEmailSubject}</span>
              </div>
              <div className="bg-background/50 border border-border rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed">
                {analysis.suggestedEmailBody}
              </div>
            </AnalysisSection>
          )}
        </div>
      )}

      {/* Placeholders */}
      {!analysis && conversation.status !== "PROCESSING" && conversation.status !== "DRAFT" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-dashed border-border/50 p-6">
            <h2 className="font-semibold mb-2">{labels.internalSummary}</h2>
            <p className="text-sm text-muted-foreground/60">{labels.summaryPlaceholder}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-dashed border-border/50 p-5">
              <h2 className="font-semibold mb-2">{labels.keyTopics}</h2>
              <p className="text-sm text-muted-foreground/60">{labels.topicsPlaceholder}</p>
            </div>
            <div className="rounded-xl border border-dashed border-border/50 p-5">
              <h2 className="font-semibold mb-2">{labels.actionItems}</h2>
              <p className="text-sm text-muted-foreground/60">{labels.actionsPlaceholder}</p>
            </div>
          </div>
        </div>
      )}

      {/* Processing state */}
      {conversation.status === "PROCESSING" && !analysis && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-6 text-center">
          <div className="w-8 h-8 mx-auto mb-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">{labels.processingMessage}</p>
        </div>
      )}

      {/* Analysis cost */}
      {analysisCost !== null && (
        <div className="mt-2 text-xs text-muted-foreground/50 text-end">
          {rtl ? "עלות ניתוח" : "Analysis cost"}: ~${analysisCost.toFixed(4)}
        </div>
      )}

      {/* AI Chat */}
      <div className="mt-6">
        {analysis ? (
          <ConversationChat
            conversationId={conversation.id}
            initialMessages={initialMessages}
            initialThreadId={initialThreadId}
            outputLanguage={lang}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-border/50 p-6">
            <h2 className="font-semibold mb-2">{labels.aiChat}</h2>
            <p className="text-sm text-muted-foreground/60">{labels.chatPlaceholder}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AnalysisSection({
  title,
  copyText,
  children,
}: {
  title: string;
  copyText?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">{title}</h2>
        {copyText && <CopyButton text={copyText} />}
      </div>
      {children}
    </div>
  );
}

function ListSection({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  const copyText = items.join("\n");
  return (
    <div className="rounded-xl border border-border bg-card/60 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">{title}</h2>
        {items.length > 0 && <CopyButton text={copyText} />}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground/60">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li key={i} className="text-sm text-muted-foreground flex gap-2">
              <span className="shrink-0 text-primary">&bull;</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
