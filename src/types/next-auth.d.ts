import { WorkspaceMemberRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
      emailVerified: boolean;
      activeWorkspaceId: string;
      activeWorkspaceRole: WorkspaceMemberRole;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    activeWorkspaceId: string;
    activeWorkspaceRole: WorkspaceMemberRole;
    emailVerified: boolean;
  }
}
