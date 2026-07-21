import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ShareableType = "task" | "note" | "folder";
export type SharePermission = "view" | "comment" | "edit" | "owner" | null;

export interface ShareAccess {
  permission: SharePermission;
  canView: boolean;
  canComment: boolean;
  canEdit: boolean;
  isOwner: boolean;
  loading: boolean;
  shares: ShareRow[];
}

export interface ShareRow {
  id: string;
  owner_id: string;
  recipient_id: string | null;
  recipient_email: string;
  permission: Exclude<SharePermission, "owner" | null>;
  accepted_at: string | null;
  created_at: string;
}

function permissionLevel(p: Exclude<SharePermission, null>): number {
  if (p === "owner") return 4;
  const map = { view: 1, comment: 2, edit: 3 };
  return map[p] || 0;
}

export function useShareAccess(
  resourceType: ShareableType,
  resourceId: string | undefined,
  resourceOwnerId?: string | null,
): ShareAccess {
  const { user } = useAuth();
  const [permission, setPermission] = useState<SharePermission>(null);
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [loading, setLoading] = useState(true);

  const isOwner = useMemo(() => {
    return !!user && !!resourceOwnerId && user.id === resourceOwnerId;
  }, [user, resourceOwnerId]);

  useEffect(() => {
    setPermission(null);
    setShares([]);
    setLoading(true);
    if (!user || !resourceId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      const [{ data: perm }, { data: rows }] = await Promise.all([
        supabase.rpc("get_effective_share_permission", {
          _user_id: user.id,
          _resource_type: resourceType,
          _resource_id: resourceId,
        }),
        supabase
          .from("shares")
          .select("id,owner_id,recipient_id,recipient_email,permission,accepted_at,created_at")
          .eq("resource_type", resourceType)
          .eq("resource_id", resourceId)
          .order("created_at", { ascending: false })
          .returns<ShareRow[]>(),
      ]);
      if (cancelled) return;

      let effective: SharePermission = null;
      if (isOwner) {
        effective = "owner";
      } else if (typeof perm === "string") {
        effective = perm as SharePermission;
      }
      // Fallback: the RPC may return null even when the user is the recipient
      // (e.g. pending share). Compute from fetched rows as well.
      const matched = (rows || []).filter(
        (s) => s.recipient_id === user.id || s.recipient_email.toLowerCase() === (user.email || "").toLowerCase(),
      );
      if (effective === null && matched.length > 0) {
        const accepted = matched
          .filter((s) => s.accepted_at)
          .map((s) => s.permission);
        if (accepted.length > 0) {
          effective = accepted.reduce((a, b) => (permissionLevel(a) >= permissionLevel(b) ? a : b));
        }
      }

      setPermission(effective);
      setShares((rows || []) as ShareRow[]);
      setLoading(false);
    };

    load();

    const channel = supabase
      .channel(`share-access-${resourceType}-${resourceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shares", filter: `resource_type=eq.${resourceType}` },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user, resourceType, resourceId, isOwner]);

  return useMemo(() => {
    const level = isOwner ? 4 : permission ? permissionLevel(permission) : 0;
    return {
      permission,
      canView: level >= 1,
      canComment: level >= 2,
      canEdit: level >= 3,
      isOwner,
      loading,
      shares,
    };
  }, [permission, isOwner, loading, shares]);
}
