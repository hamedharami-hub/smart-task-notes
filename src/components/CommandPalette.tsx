import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Home, ListTodo, FileText, Calendar, Target, Heart, Brain, Sparkles,
  Timer, Settings, BarChart3, BookOpen, Folder, Hash,
} from "lucide-react";

type Hit = { kind: "task" | "note" | "folder" | "tag"; id: string; title: string };

const NAV = [
  { label: "خانه", to: "/app/home", icon: Home, keywords: "home dashboard خانه داشبورد" },
  { label: "امروز", to: "/app/today", icon: ListTodo, keywords: "today امروز" },
  { label: "هفت روز آینده", to: "/app/next7", icon: Calendar, keywords: "week 7" },
  { label: "تقویم", to: "/app/calendar", icon: Calendar, keywords: "calendar تقویم" },
  { label: "نوت‌ها", to: "/app/notes", icon: FileText, keywords: "notes نوت یادداشت" },
  
  { label: "عادات", to: "/app/habits", icon: Heart, keywords: "habits عادت" },
  { label: "Pomodoro", to: "/app/pomodoro", icon: Timer, keywords: "pomodoro تمرکز" },
  { label: "داشبورد ذهن", to: "/app/mind", icon: Brain, keywords: "mind ذهن داشبورد" },
  { label: "خودشناسی", to: "/app/self", icon: Brain, keywords: "self شخصیت" },
  { label: "چک‌این روزانه", to: "/app/checkin", icon: Heart, keywords: "checkin checkin روزانه" },
  { label: "ثبت افکار CBT", to: "/app/thoughts", icon: Brain, keywords: "thought cbt افکار" },
  { label: "مدل ABC", to: "/app/abc", icon: Brain, keywords: "abc الگو" },
  { label: "چت سقراطی", to: "/app/socratic", icon: Brain, keywords: "socratic سقراط" },
  { label: "تمرین تنفس", to: "/app/breathing", icon: Heart, keywords: "breath breathing تنفس مدیتیشن" },
  { label: "درباره من", to: "/app/about-me", icon: Sparkles, keywords: "about me من" },
  { label: "تنظیمات", to: "/app/settings", icon: Settings, keywords: "settings تنظیمات" },
];

export default function CommandPalette() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // debounced search
  useEffect(() => {
    if (!user || !open) return;
    const term = q.trim();
    if (!term || term.length < 2) { setHits([]); return; }
    const t = setTimeout(async () => {
      const [tasks, notes, folders, tags] = await Promise.all([
        supabase.from("tasks").select("id,title").eq("user_id", user.id).ilike("title", `%${term}%`).limit(8),
        supabase.from("notes").select("id,title").eq("user_id", user.id).ilike("title", `%${term}%`).limit(6),
        supabase.from("folders").select("id,name").eq("user_id", user.id).ilike("name", `%${term}%`).limit(4),
        supabase.from("tags").select("id,name").eq("user_id", user.id).ilike("name", `%${term}%`).limit(4),
      ]);
      const all: Hit[] = [
        ...(tasks.data || []).map((x) => ({ kind: "task" as const, id: x.id, title: x.title })),
        ...(notes.data || []).map((x) => ({ kind: "note" as const, id: x.id, title: x.title })),
        ...(folders.data || []).map((x) => ({ kind: "folder" as const, id: x.id, title: x.name })),
        ...(tags.data || []).map((x) => ({ kind: "tag" as const, id: x.id, title: x.name })),
      ];
      setHits(all);
    }, 200);
    return () => clearTimeout(t);
  }, [q, user, open]);

  const go = useCallback((to: string) => { setOpen(false); setQ(""); navigate(to); }, [navigate]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput dir="rtl" placeholder="جستجو در تسک، نوت، فولدر، تگ یا رفتن به…  (Cmd/Ctrl+K)" value={q} onValueChange={setQ} />
      <CommandList>
        <CommandEmpty>چیزی پیدا نشد.</CommandEmpty>

        {hits.length > 0 && (
          <>
            <CommandGroup heading="نتایج جستجو">
              {hits.map((h) => {
                const Icon = h.kind === "task" ? ListTodo : h.kind === "note" ? FileText : h.kind === "folder" ? Folder : Hash;
                const to = h.kind === "task" ? `/app/tasks/${h.id}` :
                           h.kind === "note" ? `/app/notes` :
                           h.kind === "folder" ? `/app/folder/${h.id}` : `/app/tag/${h.id}`;
                return (
                  <CommandItem key={`${h.kind}-${h.id}`} value={`${h.kind} ${h.title}`} onSelect={() => go(to)}>
                    <Icon className="w-4 h-4 ms-2 text-muted-foreground" />
                    <span>{h.title}</span>
                    <span className="ms-auto text-[10px] text-muted-foreground">
                      {h.kind === "task" ? "تسک" : h.kind === "note" ? "نوت" : h.kind === "folder" ? "فولدر" : "تگ"}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="رفتن به">
          {NAV.map((n) => {
            const Icon = n.icon;
            return (
              <CommandItem key={n.to} value={`${n.label} ${n.keywords}`} onSelect={() => go(n.to)}>
                <Icon className="w-4 h-4 ms-2 text-muted-foreground" />
                <span>{n.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
