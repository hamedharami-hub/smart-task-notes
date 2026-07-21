import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Pencil, Trash2, Sparkles, FolderPlus, Copy, Palette, Share2 } from "lucide-react";
import { useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ShareDialog from "@/components/ShareDialog";
import { useShareAccess } from "@/hooks/useShareAccess";
import { useAuth } from "@/hooks/useAuth";

type Item = { id: string; user_id?: string; name: string; color?: string };
type Kind = "folder" | "tag";

interface Props {
  item: Item | null;
  kind: Kind;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  onAIChat?: () => void;
  onAddSubfolder?: () => void;
  onChanged?: () => void;
}

const COLORS = ["#94a3b8", "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#a855f7", "#ec4899"];

export default function SidebarItemSheet({ item, kind, onOpenChange, onDelete, onAIChat, onAddSubfolder, onChanged }: Props) {
  const { i18n } = useTranslation();
  const isEn = (i18n.language || "fa").startsWith("en");
  const T = (fa: string, en: string) => (isEn ? en : fa);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const { user } = useAuth();
  const { isOwner } = useShareAccess(kind === "folder" ? "folder" : "folder", kind === "folder" && item ? item.id : "", item?.user_id);
  const owns = kind === "tag" ? item?.user_id === user?.id : isOwner;
  if (!item) return null;
  const table = kind === "folder" ? "folders" : "tags";

  const Item = ({ icon: Icon, label, onClick, danger, disabled }: {
    icon: ComponentType<{ className?: string }>;
    label: string;
    onClick: () => void;
    danger?: boolean;
    disabled?: boolean;
  }) => (
    <button
      onClick={disabled ? undefined : () => { onClick(); }}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition text-start ${
        disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-accent active:scale-[0.98]"
      } ${danger ? "text-destructive" : ""}`}
    >
      <Icon className="w-4 h-4" />
      <span className="text-sm">{label}</span>
    </button>
  );

  const submitRename = async () => {
    if (!owns) { toast(T("فقط صاحب می‌تواند نام را تغییر دهد", "Only the owner can rename")); return; }
    const v = name.trim();
    if (!v) return;
    const { error } = await supabase.from(table).update({ name: v }).eq("id", item.id);
    if (error) toast.error(error.message);
    else { toast.success(T("تغییر نام شد", "Renamed")); setRenaming(false); onChanged?.(); onOpenChange(false); }
  };

  const setColor = async (c: string) => {
    if (!owns) { toast(T("فقط صاحب می‌تواند رنگ را تغییر دهد", "Only the owner can change color")); return; }
    const { error } = await supabase.from(table).update({ color: c }).eq("id", item.id);
    if (error) toast.error(error.message);
    else { onChanged?.(); }
  };

  return (
    <>
    <Sheet open={!!item && !shareOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-6">
        <SheetHeader>
          <SheetTitle className="text-start text-base truncate flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: item.color || "#94a3b8" }} />
            {item.name}
          </SheetTitle>
        </SheetHeader>

        {renaming ? (
          <div className="mt-3 flex items-center gap-2">
            <Input autoFocus defaultValue={item.name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitRename()}
              placeholder={T(`نام ${kind === "folder" ? "فولدر" : "تگ"}`, `${kind === "folder" ? "Folder" : "Tag"} name`)} />
            <Button onClick={submitRename} size="sm">{T("ذخیره", "Save")}</Button>
          </div>
        ) : (
          <div className="mt-3 space-y-1">
            <Item icon={Pencil} label={T("تغییر نام", "Rename")} disabled={!owns} onClick={() => { setName(item.name); setRenaming(true); }} />
            {kind === "folder" && (
              <Item icon={Share2} label={T("اشتراک‌گذاری…", "Share…")} disabled={!owns} onClick={() => setShareOpen(true)} />
            )}
            {kind === "folder" && onAIChat && (
              <Item icon={Sparkles} label={T("چت AI روی این فولدر", "AI chat on this folder")} disabled={!owns} onClick={() => { onAIChat(); onOpenChange(false); }} />
            )}
            {kind === "folder" && onAddSubfolder && (
              <Item icon={FolderPlus} label={T("افزودن زیرفولدر", "Add subfolder")} disabled={!owns} onClick={() => { onAddSubfolder(); onOpenChange(false); }} />
            )}
            <Item icon={Copy} label={T("کپی نام", "Copy name")} onClick={async () => {
              try { await navigator.clipboard.writeText(item.name); toast.success(T("کپی شد", "Copied")); } catch { /* noop */ }
              onOpenChange(false);
            }} />
            <div className="px-3 py-3 rounded-lg">
              <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                <Palette className="w-4 h-4" /> {T("رنگ", "Color")}
              </div>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setColor(c)} disabled={!owns} aria-label={c}
                    className={`w-7 h-7 rounded-full ring-2 ring-transparent transition ${owns ? "hover:ring-primary active:scale-90" : "opacity-40 cursor-not-allowed"}`}
                    style={{ backgroundColor: c, borderColor: item.color === c ? "white" : "transparent" }} />
                ))}
              </div>
            </div>
            <Item icon={Trash2} label={T("حذف", "Delete")} danger disabled={!owns} onClick={() => { onOpenChange(false); onDelete(); }} />
          </div>
        )}
      </SheetContent>
    </Sheet>
    {kind === "folder" && (
      <ShareDialog
        open={shareOpen}
        onOpenChange={(v) => { setShareOpen(v); if (!v) onOpenChange(false); }}
        resourceType="folder"
        resourceId={item.id}
        resourceTitle={item.name}
      />
    )}
    </>
  );
}
