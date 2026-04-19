import { db } from "@/lib/db";

interface AuditParams {
  workspaceId: string;
  userId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

export function logAudit(params: AuditParams): void {
  db.auditLog
    .create({
      data: {
        workspaceId: params.workspaceId,
        userId: params.userId ?? undefined,
        action: params.action,
        targetType: params.targetType ?? undefined,
        targetId: params.targetId ?? undefined,
        metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
        ipAddress: params.ipAddress ?? undefined,
      },
    })
    .catch((err) => console.error("Audit log failed:", err));
}
