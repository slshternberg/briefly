import { requireAuth } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { getLabels } from "@/lib/ui-labels";
import { LanguageSelector } from "@/components/settings/language-selector";
import { CustomInstructions } from "@/components/settings/custom-instructions";
import { StyleExamples } from "@/components/settings/style-examples";

export default async function SettingsPage() {
  const { workspace, role } = await requireAuth();

  const ws = await db.workspace.findUnique({
    where: { id: workspace.id },
    select: { defaultLanguage: true, customInstructions: true },
  });

  const canEdit = role === "OWNER" || role === "ADMIN";
  const labels = getLabels(workspace.defaultLanguage);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">{labels.workspaceSettings}</h1>

      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-card/60 p-6">
          <h2 className="font-semibold mb-1">{labels.workspaceName}</h2>
          <p className="text-sm text-muted-foreground">{workspace.name}</p>
        </div>

        <div className="rounded-xl border border-border bg-card/60 p-6">
          <h2 className="font-semibold mb-1">{labels.defaultLanguage}</h2>
          <p className="text-xs text-muted-foreground mb-3">
            {labels.defaultLanguageDesc}
          </p>
          <LanguageSelector
            currentLanguage={ws?.defaultLanguage || "Hebrew"}
            canEdit={canEdit}
          />
        </div>

        <div className="rounded-xl border border-border bg-card/60 p-6">
          <h2 className="font-semibold mb-1">{labels.customInstructions}</h2>
          <p className="text-xs text-muted-foreground mb-3">
            {labels.customInstructionsDesc}
          </p>
          <CustomInstructions
            currentInstructions={ws?.customInstructions || ""}
            canEdit={canEdit}
          />
        </div>

        <div className="rounded-xl border border-border bg-card/60 p-6">
          <h2 className="font-semibold mb-1">{labels.styleLearnTitle}</h2>
          <p className="text-xs text-muted-foreground mb-3">
            {labels.styleLearnDesc}
          </p>
          <StyleExamples canEdit={canEdit} />
        </div>
      </div>
    </div>
  );
}
