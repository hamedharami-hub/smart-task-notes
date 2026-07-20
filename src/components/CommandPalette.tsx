import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ListTodo, FileText, Calendar, Target, Heart, Brain, Sparkles,
  Timer, Settings, BarChart3, BookOpen, Folder, Hash,
} from "lucide-react";

type Hit = { kind: "task" | "note" | "folder" | "tag"; id: string; title: string };

const NAV = [
  { label: "اینباکس", to: "/app/inbox", icon: ListTodo, keywords: "inbox اینباکس ورودی" },
  { label: "امروز", to: "/app/today", icon: ListTodo, keywords: "today امروز" },
  { label: "فردا", to: "/app/tomorrow", icon: Calendar, keywords: "tomorrow فردا" },
  { label: "هفت روز آینده", to: "/app/next7", icon: Calendar, keywords: "week 7 آینده" },
  { label: "تقویم", to: "/app/calendar", icon: Calendar, keywords: "calendar تقویم" },
  { label: "نوت‌ها", to: "/app/notes", icon: FileText, keywords: "notes نوت یادداشت" },
  { label: "عادات", to: "/app/habits", icon: Heart, keywords: "habits عادت" },
  { label: "Pomodoro", to: "/app/pomodoro", icon: Timer, keywords: "pomodoro تمرکز" },
  { label: "آمار", to: "/app/stats", icon: BarChart3, keywords: "stats summary statistics آمار خلاصه" },
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

  // debounced search — tasks (title + description), notes (title + content),
  // subtasks (and map to parent tasks), folders, tags
  useEffect(() => {
    if (!user || !open) return;
    const term = q.trim();
    if (!term || term.length < 2) { setHits([]); return; }
    const pattern = `%${term}%`;
    const t = setTimeout(async () => {
      const [tasksRes, notesRes, foldersRes, tagsRes, subtasksRes] = await Promise.all([
        supabase.from("tasks").select("id,title").eq("user_id", user.id).or(`title.ilike.${pattern},description.ilike.${pattern}`).limit(8),
        supabase.from("notes").select("id,title").eq("user_id", user.id).or(`title.ilike.${pattern},content.ilike.${pattern}`).limit(6),
        supabase.from("folders").select("id,name").eq("user_id", user.id).ilike("name", pattern).limit(4),
        supabase.from("tags").select("id,name").eq("user_id", user.id).ilike("name", pattern).limit(4),
        supabase.from("subtasks").select("task_id").eq("user_id", user.id).ilike("title", pattern).limit(8),
      ]);

      // Resolve subtask hits into their parent tasks
      const subtaskRows = (subtasksRes.data || []) as { task_id: string }[];
      const subtaskTaskIds = Array.from(new Set(subtaskRows.map((s) => s.task_id).filter(Boolean)));
      let subtaskTasks: { id: string; title: string }[] = [];
      if (subtaskTaskIds.length) {
        const { data } = await supabase.from("tasks").select("id,title").eq("user_id", user.id).in("id", subtaskTaskIds);
        subtaskTasks = (data as { id: string; title: string }[]) || [];
      }

      const taskMap = new Map<string, Hit>();
      const addTask = (id: string, title: string) => {
        if (!taskMap.has(id)) taskMap.set(id, { kind: "task", id, title });
      };
      ((tasksRes.data || []) as { id: string; title: string }[]).forEach((x) => addTask(x.id, x.title));
      subtaskTasks.forEach((x) => addTask(x.id, x.title));

      const rank = (title: string) => {
        const t = title.toLowerCase();
        const q = term.toLowerCase();
        if (t === q) return 3;
        if (t.startsWith(q)) return 2;
        if (t.includes(q)) return 1;
        return 0;
      };

      const all: Hit[] = [
        ...taskMap.values(),
        ...((notesRes.data || []) as { id: string; title: string }[]).map((x) => ({ kind: "note" as const, id: x.id, title: x.title })),
        ...((foldersRes.data || []) as { id: string; name: string }[]).map((x) => ({ kind: "folder" as const, id: x.id, title: x.name })),
        ...((tagsRes.data || []) as { id: string; name: string }[]).map((x) => ({ kind: "tag" as const, id: x.id, title: x.name })),
      ];
      all.sort((a, b) => rank(b.title) - rank(a.title));
      setHits(all.slice(0, 20));
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
