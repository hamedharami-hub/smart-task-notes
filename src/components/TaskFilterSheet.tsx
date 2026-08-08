import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Filter, Save, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type SortKey = "due" | "priority" | "created";
export type SortDir = "asc" | "desc";
export type SortLevel = { key: SortKey; dir: SortDir };

export type TaskFilters = {
  folder_ids: string[];
  tag_ids: string[];
  priorities: string[]; // none|low|medium|high
  show_completed: boolean;
  // Two-level sort: primary then secondary
  sort_primary: SortLevel;
  sort_secondary: SortLevel;
  // Legacy single-key sort kept for backward compat
  sort?: "priority" | "due_asc" | "due_desc" | "created_desc" | "alpha";
};

export const DEFAULT_FILTERS: TaskFilters = {
  folder_ids: [],
  tag_ids: [],
  priorities: [],
  show_completed: false,
  sort_primary: { key: "due", dir: "asc" },
  sort_secondary: { key: "priority", dir: "asc" },
  sort: "priority",
};

const PROFILES_KEY = "task_filter_profiles_v1";

type Profile = { name: string; filters: TaskFilters };

const SORT_LABELS: Record<SortKey, string> = {
  due: "سررسید",
  priority: "اولویت",
  created: "تاریخ ساخت",
};

const SORT_KEYS: SortKey[] = ["due", "priority", "created"];

function SortLevelPicker({
  label,
  value,
  onChange,
  excludeKey,
}: {
  label: string;
  value: SortLevel;
  onChange: (v: SortLevel) => void;
  excludeKey?: SortKey;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1.5 items-center">
        {SORT_KEYS.filter((k) => k !== excludeKey).map((k) => {
          const active = value.key === k;
          return (
            <button
              key={k}
              onClick={() => onChange({ ...value, key: k })}
              className={`px-2.5 py-1 text-xs rounded-md border ${active ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"}`}
            >
              {SORT_LABELS[k]}
            </button>
          );
        })}
        <div className="flex border rounded-md overflow-hidden ms-auto">
          <button
            onClick={() => onChange({ ...value, dir: "asc" })}
            className={`px-2 py-1 ${value.dir === "asc" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
            aria-label="صعودی"
            title="صعودی"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onChange({ ...value, dir: "desc" })}
            className={`px-2 py-1 ${value.dir === "desc" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
            aria-label="نزولی"
            title="نزولی"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function TaskFilterSheet({
  filters,
  onChange,
}: {
  filters: TaskFilters;
  onChange: (f: TaskFilters) => void;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [tags, setTags] = useState<{ id: string; name: string }[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileName, setProfileName] = useState("");

  // Migrate legacy filters that don't yet have sort_primary/secondary
  useEffect(() => {
    if (!filters.sort_primary || !filters.sort_secondary) {
      onChange({ ...DEFAULT_FILTERS, ...filters, sort_primary: filters.sort_primary || DEFAULT_FILTERS.sort_primary, sort_secondary: filters.sort_secondary || DEFAULT_FILTERS.sort_secondary });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("folders").select("id,name").order("position").then(({ data }) => {
      setFolders((data || []) as any);
    });
    supabase.from("tags").select("id,name").then(({ data }) => {
      setTags((data || []) as any);
    });
    try {
      const raw = localStorage.getItem(PROFILES_KEY);
      if (raw) setProfiles(JSON.parse(raw));
    } catch {}
  }, [user]);

  const saveProfiles = (list: Profile[]) => {
    setProfiles(list);
    localStorage.setItem(PROFILES_KEY, JSON.stringify(list));
  };

  const toggle = <K extends keyof TaskFilters>(key: K, value: string) => {
    const arr = (filters[key] as unknown as string[]) || [];
    const next = arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
    onChange({ ...filters, [key]: next } as TaskFilters);
  };

  const primary = filters.sort_primary || DEFAULT_FILTERS.sort_primary;
  const secondary = filters.sort_secondary || DEFAULT_FILTERS.sort_secondary;

  const sortChanged =
    primary.key !== DEFAULT_FILTERS.sort_primary.key ||
    primary.dir !== DEFAULT_FILTERS.sort_primary.dir ||
    secondary.key !== DEFAULT_FILTERS.sort_secondary.key ||
    secondary.dir !== DEFAULT_FILTERS.sort_secondary.dir;

  const activeCount =
    filters.folder_ids.length +
    filters.tag_ids.length +
    filters.priorities.length +
    (filters.show_completed ? 1 : 0) +
    (sortChanged ? 1 : 0);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 rounded-full relative" title="فیلتر" aria-label="فیلتر">
          <Filter className="w-4 h-4" />
          {activeCount > 0 && (
            <Badge variant="secondary" className="absolute -top-1 -end-1 h-4 min-w-4 px-1 text-[9px] leading-none flex items-center justify-center rounded-full">{activeCount}</Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent dir="rtl" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>فیلتر و مرتب‌سازی</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-4">
          {/* Profiles */}
          <section>
            <div className="text-xs text-muted-foreground mb-2">پروفایل‌های ذخیره‌شده</div>
            {profiles.length === 0 && (
              <p className="text-xs text-muted-foreground">هنوز پروفایلی ذخیره نشده</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {profiles.map((p) => (
                <div key={p.name} className="flex items-center gap-1 border rounded-md px-1">
                  <button
                    onClick={() => { onChange(p.filters); toast.success(`پروفایل «${p.name}» اعمال شد`); }}
                    className="text-xs px-2 py-1 hover:bg-accent rounded"
                  >
                    {p.name}
                  </button>
                  <button
                    onClick={() => saveProfiles(profiles.filter((x) => x.name !== p.name))}
                    className="p-0.5 text-muted-foreground hover:text-destructive"
                    aria-label="حذف"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Input
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="نام پروفایل..."
                className="h-8 text-xs"
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={!profileName.trim()}
                onClick={() => {
                  const name = profileName.trim();
                  const next = [...profiles.filter((p) => p.name !== name), { name, filters }];
                  saveProfiles(next);
                  setProfileName("");
                  toast.success("ذخیره شد");
                }}
                className="gap-1"
              >
                <Save className="w-3 h-3" /> ذخیره
              </Button>
            </div>
          </section>

          {/* Two-level sort */}
          <section className="space-y-3 border rounded-md p-3 bg-muted/30">
            <div className="text-xs font-medium">مرتب‌سازی دوگانه</div>
            <SortLevelPicker
              label="اولویت اول"
              value={primary}
              onChange={(v) => onChange({ ...filters, sort_primary: v })}
              excludeKey={secondary.key}
            />
            <SortLevelPicker
              label="اولویت دوم (در صورت برابری)"
              value={secondary}
              onChange={(v) => onChange({ ...filters, sort_secondary: v })}
              excludeKey={primary.key}
            />
          </section>

          {/* Priority */}
          <section>
            <div className="text-xs text-muted-foreground mb-2">فیلتر اولویت</div>
            <div className="flex flex-wrap gap-1.5">
              {[
                ["high", "🔴 بالا"],
                ["medium", "🟡 متوسط"],
                ["low", "🔵 پایین"],
                ["none", "⚪ بدون"],
              ].map(([v, l]) => {
                const active = filters.priorities.includes(v);
                return (
                  <button
                    key={v}
                    onClick={() => toggle("priorities", v)}
                    className={`px-2.5 py-1 text-xs rounded-md border ${active ? "bg-primary/15 border-primary text-primary" : "hover:bg-accent"}`}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Folders */}
          {folders.length > 0 && (
            <section>
              <div className="text-xs text-muted-foreground mb-2">فولدرها</div>
              <div className="flex flex-wrap gap-1.5">
                {folders.map((f) => {
                  const active = filters.folder_ids.includes(f.id);
                  return (
                    <button
                      key={f.id}
                      onClick={() => toggle("folder_ids", f.id)}
                      className={`px-2.5 py-1 text-xs rounded-md border ${active ? "bg-primary/15 border-primary text-primary" : "hover:bg-accent"}`}
                    >
                      📁 {f.name}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <section>
              <div className="text-xs text-muted-foreground mb-2">تگ‌ها</div>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => {
                  const active = filters.tag_ids.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggle("tag_ids", t.id)}
                      className={`px-2.5 py-1 text-xs rounded-md border ${active ? "bg-primary/15 border-primary text-primary" : "hover:bg-accent"}`}
                    >
                      #{t.name}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Show completed */}
          <section className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">نمایش تسک‌های انجام‌شده</span>
            <button
              onClick={() => onChange({ ...filters, show_completed: !filters.show_completed })}
              className={`px-3 py-1 text-xs rounded-md border ${filters.show_completed ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"}`}
            >
              {filters.show_completed ? "روشن" : "خاموش"}
            </button>
          </section>

          <div className="flex gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => onChange(DEFAULT_FILTERS)} className="flex-1">
              ریست
            </Button>
            <Button size="sm" onClick={() => setOpen(false)} className="flex-1">
              اعمال
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
