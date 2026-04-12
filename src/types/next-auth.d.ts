import { DefaultSession } from "next-auth";
import { WorkspaceMemberRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      activeWorkspaceId: string;
      activeWorkspaceRole: WorkspaceMemberRole;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    activeWorkspaceId: string;
    activeWorkspaceRole: WorkspaceMemberRole;
  }
}
