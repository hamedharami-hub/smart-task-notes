import { useEffect, useState } from "react";
import {
  Inbox, Calendar as CalIcon, CalendarDays, Filter, FolderTree, Tag, FileText,
  Target, Timer, Calendar, Plus, ChevronRight, ChevronDown, LogOut, Sparkles, Settings, LayoutGrid,
  Brain, TrendingUp, Moon, HeartPulse, Activity, MessageCircleQuestion, Zap, Clock4, Heart, ShieldAlert, BookOpen, Sun,
  ListTodo, BrainCircuit, Wrench, GripVertical, RotateCcw, User, Trash2, Shield, Users, Flame,
  BarChart3, Sprout, Wind, Folder as FolderIcon,
} from "lucide-react";
import { StreakCard } from "@/components/StreakCard";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar, SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import FolderAIChat from "@/components/FolderAIChat";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FolderDeleteDialog } from "@/components/FolderDeleteDialog";
import { TagDeleteDialog } from "@/components/TagDeleteDialog";
import { readItemDrag, moveItemToFolder } from "@/lib/dragToFolder";
import { useTranslation } from "react-i18next";
import SidebarItemSheet from "@/components/SidebarItemSheet";
import { useLongPress } from "@/lib/useLongPress";
import { cacheGet, cacheSet, enqueueOp } from "@/lib/offlineQueue";

// Bilingual label maps. SECTIONS uses the Persian label as the canonical key.
const EN_LABELS: Record<string, string> = {
  "انجام دادن": "Do",
  "رشد": "Grow",
  "ذهن": "Mind",
  "خودِ من": "Me",
  "امروز": "Today",
  "فردا": "Tomorrow",
  "۷ روز آینده": "Next 7 Days",
  "تقویم": "Calendar",
  "اهداف": "Goals",
  "عادت‌ها": "Habits",
  "نوت‌ها": "Notes",
  "مرور (SR)": "Review (SR)",
  "خودشناسی": "Self-Knowledge",
  "داشبورد ذهن": "Mind Dashboard",
  "بینش هفتگی": "Weekly Insights",
  "بازنگری هفتگی": "Weekly Review",
  "Check-in روزانه": "Daily Check-in",
  "چک‌این روزانه": "Daily Check-in",
  "ژورنال تصمیم": "Decision Journal",
  "ثبت افکار (CBT)": "Thought Records (CBT)",
  "مدل ABC": "ABC Model",
  "چت سقراطی": "Socratic Chat",
  "درباره من": "About Me",
  "تنظیمات": "Settings",
  "پنل مدیریت": "Admin Panel",
  "جابجا کن": "Drag",
  "فولدرها": "Folders",
  "تگ‌ها": "Tags",
  "اشتراک‌ها": "Shared with me",
  "Pomodoro": "Pomodoro",
  "Smart Lists": "Smart Lists",
  "آمار و خلاصه": "Stats & Summary",
  "بازه‌های کلی": "Time Buckets",
  "سیکل پریود": "Period Cycle",
  "تمرین تنفس ۳بعدی": "3D Breathing",
  "صندوق ورودی": "Inbox",
};
const FA_LABELS: Record<string, string> = {
  "Inbox": "صندوق ورودی",
  "Pomodoro": "پومودورو",
  "Smart Lists": "لیست‌های هوشمند",
};

function useLabel() {
  const { i18n } = useTranslation();
  const lang = (i18n.language || "fa").split("-")[0];
  return (label: string) => {
    if (lang === "en") return EN_LABELS[label] || label;
    return FA_LABELS[label] || label;
  };
}

type Folder = { id: string; user_id?: string; name: string; parent_id: string | null; color: string };
type TagT = { id: string; user_id?: string; name: string; color: string };

type NavItem = { url: string; icon: any; label: string };
type Section = { id: string; title: string; icon: any; defaultOpen: boolean; items: NavItem[] };

const SECTIONS: Section[] = [
  {
    id: "do", title: "انجام دادن", icon: ListTodo, defaultOpen: true,
    items: [
      { url: "/app/today", icon: CalIcon, label: "امروز" },
      { url: "/app/inbox", icon: Inbox, label: "صندوق ورودی" },
      { url: "/app/tomorrow", icon: Sun, label: "فردا" },
      { url: "/app/next7", icon: CalendarDays, label: "۷ روز آینده" },
      { url: "/app/calendar", icon: Calendar, label: "تقویم" },
      { url: "/app/buckets", icon: CalendarDays, label: "بازه‌های کلی" },
      { url: "/app/smart", icon: Filter, label: "Smart Lists" },
      { url: "/app/pomodoro", icon: Timer, label: "Pomodoro" },
      { url: "/app/stats", icon: BarChart3, label: "آمار و خلاصه" },
    ],
  },
  {
    id: "grow", title: "رشد", icon: TrendingUp, defaultOpen: false,
    items: [
      { url: "/app/garden", icon: Sprout, label: "باغ رشد" },
      { url: "/app/habits", icon: Target, label: "عادت‌ها" },
      { url: "/app/notes", icon: FileText, label: "نوت‌ها" },
      { url: "/app/cycle", icon: Calendar, label: "سیکل پریود" },
    ],
  },
  {
    id: "mind", title: "ذهن", icon: BrainCircuit, defaultOpen: false,
    items: [
      { url: "/app/mind", icon: BrainCircuit, label: "داشبورد ذهن" },
      { url: "/app/checkin", icon: Activity, label: "چک‌این روزانه" },
      { url: "/app/thoughts", icon: BookOpen, label: "ثبت افکار (CBT)" },
      { url: "/app/abc", icon: Zap, label: "مدل ABC" },
      { url: "/app/socratic", icon: MessageCircleQuestion, label: "چت سقراطی" },
      { url: "/app/breathing", icon: Wind, label: "تمرین تنفس ۳بعدی" },
    ],
  },
  {
    id: "me", title: "خودِ من", icon: User, defaultOpen: false,
    items: [
      { url: "/app/about-me", icon: User, label: "درباره من" },
      { url: "/app/self", icon: Sparkles, label: "خودشناسی" },
      { url: "/app/shared", icon: Users, label: "اشتراک‌ها" },
    ],
  },
];

// Default order: folders → tags → tasks → notes → self → mind → settings
const DEFAULT_ORDER = ["__folders", "__tags", "do", "grow", "mind", "me"];
const ORDER_KEY = "sidebar_order_v1";

function loadOrder(): string[] {
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // ensure all known ids present (in case of new sections later)
        const merged = [...parsed.filter((x) => DEFAULT_ORDER.includes(x))];
        DEFAULT_ORDER.forEach((id) => { if (!merged.includes(id)) merged.push(id); });
        return merged;
      }
    }
  } catch { void 0; }
  return DEFAULT_ORDER;
}

function SortableBlock({ id, children }: { id: string; children: (handleProps: any) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {children(listeners)}
    </div>
  );
}

function FolderRow({ folder: f, depth, hasChildren, open, collapsed, onToggle, onLongPress, onNav }: {
  folder: Folder; depth: number; hasChildren: boolean; open: boolean; collapsed: boolean;
  onToggle: () => void; onLongPress: () => void; onNav: () => void;
}) {
  const lp = useLongPress({ onLongPress, delay: 420 });
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <div
          className="flex items-center w-full gap-1.5 rounded-xl transition cursor-pointer select-none group data-[drag-over=true]:bg-primary/15 data-[drag-over=true]:ring-1 data-[drag-over=true]:ring-primary"
          style={{ paddingInlineStart: depth * 12 }}
          {...lp.handlers}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onLongPress();
          }}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes("application/x-taskflow-item")) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            (e.currentTarget as HTMLElement).dataset.dragOver = "true";
          }}
          onDragLeave={(e) => { delete (e.currentTarget as HTMLElement).dataset.dragOver; }}
          onDrop={async (e) => {
            delete (e.currentTarget as HTMLElement).dataset.dragOver;
            const payload = readItemDrag(e);
            if (!payload) return;
            e.preventDefault();
            await moveItemToFolder(payload, f.id);
          }}
        >
          {hasChildren && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
              className="p-0.5 hover:bg-muted rounded shrink-0"
              title={open ? "بستن" : "باز کردن"}
            >
              {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
          )}
          <NavLink
            to={`/app/folder/${f.id}`}
            onClick={(e) => {
              if (lp.didFire()) {
                e.preventDefault();
                return;
              }
              onNav();
            }}
            className="flex items-center justify-center gap-1.5 flex-1 w-full truncate"
            activeClassName="text-primary font-bold"
          >
            <FolderIcon
              className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110"
              style={{ color: f.color || "hsl(var(--primary))" }}
            />
            {!collapsed && <span className="truncate text-xs">{f.name}</span>}
          </NavLink>
        </div>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function TagRow({ tag: tagItem, collapsed, onLongPress, onNav }: {
  tag: TagT; collapsed: boolean; onLongPress: () => void; onNav: () => void;
}) {
  const lp = useLongPress({ onLongPress, delay: 420 });
  return (
    <SidebarMenuItem>
      <div
        className="flex items-center group w-full cursor-pointer select-none"
        {...lp.handlers}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onLongPress();
        }}
      >
        <SidebarMenuButton asChild className="flex-1">
          <NavLink
            to={`/app/tag/${tagItem.id}`}
            onClick={(e) => {
              if (lp.didFire()) {
                e.preventDefault();
                return;
              }
              onNav();
            }}
            className="flex items-center justify-center gap-1.5 w-full truncate"
            activeClassName="bg-accent text-accent-foreground font-bold"
          >
            <Tag className="w-3.5 h-3.5 shrink-0" style={{ color: tagItem.color }} />
            {!collapsed && <span className="truncate text-xs">{tagItem.name}</span>}
          </NavLink>
        </SidebarMenuButton>
      </div>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const { signOut, user } = useAuth();
  const { isAdmin } = useUserRole();
  const tr = useLabel();
  const { t } = useTranslation();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<TagT[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [newFolder, setNewFolder] = useState("");
  const [newTag, setNewTag] = useState("");
  const [openFolderDlg, setOpenFolderDlg] = useState(false);
  const [openTagDlg, setOpenTagDlg] = useState(false);
  const [aiFolder, setAiFolder] = useState<Folder | null>(null);
  const [delFolder, setDelFolder] = useState<Folder | null>(null);
  const [delTag, setDelTag] = useState<TagT | null>(null);
  const [sheetFolder, setSheetFolder] = useState<Folder | null>(null);
  const [sheetTag, setSheetTag] = useState<TagT | null>(null);
  const [order, setOrder] = useState<string[]>(loadOrder);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem("sidebar_sections_v1");
      if (raw) return JSON.parse(raw);
    } catch { void 0; }
    const init: Record<string, boolean> = Object.fromEntries(SECTIONS.map((s) => [s.id, s.defaultOpen]));
    init.__folders = true;
    init.__tags = false;
    return init;
  });
  const setSection = (id: string, open: boolean) => {
    setOpenSections((s) => {
      const n = { ...s, [id]: open };
      try { localStorage.setItem("sidebar_sections_v1", JSON.stringify(n)); } catch { void 0; }
      return n;
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldI = order.indexOf(String(active.id));
    const newI = order.indexOf(String(over.id));
    if (oldI < 0 || newI < 0) return;
    const next = arrayMove(order, oldI, newI);
    setOrder(next);
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(next)); } catch { void 0; }
  };

  const resetOrder = () => {
    setOrder(DEFAULT_ORDER);
    try { localStorage.removeItem(ORDER_KEY); } catch { void 0; }
    toast.success(t("sidebar.resetDone"));
  };

  const generateId = () => {
    try { return crypto.randomUUID(); } catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`; }
  };

  const FOLDERS_KEY = user ? `folders:${user.id}` : "";
  const TAGS_KEY = user ? `tags:${user.id}` : "";

  const load = async () => {
    if (!user) return;
    const cachedFolders = await cacheGet<Folder[]>(FOLDERS_KEY);
    const cachedTags = await cacheGet<TagT[]>(TAGS_KEY);
    if (cachedFolders) setFolders(cachedFolders);
    if (cachedTags) setTags(cachedTags);

    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    try {
      const [f, t] = await Promise.all([
        supabase.from("folders").select("*").order("position"),
        supabase.from("tags").select("*").order("name"),
      ]);
      if (f.data) {
        setFolders(f.data);
        await cacheSet(FOLDERS_KEY, f.data);
      }
      if (t.data) {
        setTags(t.data);
        await cacheSet(TAGS_KEY, t.data);
      }
    } catch {
      // Keep cached lists while offline
      void 0;
    }
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("sidebar")
      .on("postgres_changes", { event: "*", schema: "public", table: "folders" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "tags" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const closeOnMobile = () => { if (isMobile) setOpenMobile(false); };

  const createFolder = async () => {
    if (!newFolder.trim() || !user) return;
    const folder: Folder = { id: generateId(), name: newFolder, user_id: user.id, parent_id: null, color: "" };
    setFolders(prev => [...prev, folder]);
    await cacheSet(FOLDERS_KEY, [...folders, folder]);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await enqueueOp({ table: "folders", op: "insert", payload: folder });
      toast.success(t("folders.created") + " — " + t("offline.willSync", "با اتصال اینترنت همگام می‌شود"));
      setNewFolder(""); setOpenFolderDlg(false);
      return;
    }

    const { error } = await supabase.from("folders").insert({ name: newFolder, user_id: user.id });
    if (error) {
      toast.error(error.message);
      setFolders(prev => prev.filter(x => x.id !== folder.id));
    } else {
      toast.success(t("folders.created")); setNewFolder(""); setOpenFolderDlg(false);
      load();
    }
  };

  const createTag = async () => {
    if (!newTag.trim() || !user) return;
    const tag: TagT = { id: generateId(), name: newTag, user_id: user.id, color: "" };
    setTags(prev => [...prev, tag]);
    await cacheSet(TAGS_KEY, [...tags, tag]);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await enqueueOp({ table: "tags", op: "insert", payload: tag });
      toast.success(t("tags.created") + " — " + t("offline.willSync", "با اتصال اینترنت همگام می‌شود"));
      setNewTag(""); setOpenTagDlg(false);
      return;
    }

    const { error } = await supabase.from("tags").insert({ name: newTag, user_id: user.id });
    if (error) {
      toast.error(error.message);
      setTags(prev => prev.filter(x => x.id !== tag.id));
    } else {
      toast.success(t("tags.created")); setNewTag(""); setOpenTagDlg(false);
      load();
    }
  };

  const renderTree = (parentId: string | null, depth = 0) => {
    const children = folders.filter((f) => f.parent_id === parentId);
    return children.map((f) => {
      const has = folders.some((x) => x.parent_id === f.id);
      const open = expanded[f.id] ?? true;
      return (
        <div key={f.id}>
          <FolderRow
            folder={f}
            depth={depth}
            hasChildren={has}
            open={open}
            collapsed={collapsed}
            onToggle={() => setExpanded((s) => ({ ...s, [f.id]: !open }))}
            onLongPress={() => setSheetFolder(f)}
            onNav={closeOnMobile}
          />
          {has && open && renderTree(f.id, depth + 1)}
        </div>
      );
    });
  };

  const renderSection = (section: Section, dragHandle: any) => {
    const isOpen = openSections[section.id] ?? section.defaultOpen;
    const SectionIcon = section.icon;
    return (
      <SidebarGroup>
        <Collapsible open={isOpen || collapsed} onOpenChange={(v) => setSection(section.id, v)}>
          {!collapsed && (
            <SidebarGroupLabel className="flex items-center justify-between pe-1 group">
              {dragHandle && (
                <button {...dragHandle} className="cursor-grab active:cursor-grabbing p-0.5 opacity-30 hover:opacity-80 transition" title={tr("جابجا کن")}>
                  <GripVertical className="w-3 h-3" />
                </button>
              )}
              <CollapsibleTrigger className="flex items-center gap-2 flex-1 hover:bg-sidebar-accent/50 rounded transition">
                <SectionIcon className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{tr(section.title)}</span>
                <ChevronDown className={`w-3.5 h-3.5 me-auto text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`} />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
          )}
          <CollapsibleContent forceMount={collapsed ? true : undefined}>
            <SidebarGroupContent>
              <SidebarMenu>
                {(section.id === "me" && isAdmin
                  ? [...section.items, { url: "/app/admin", icon: Shield, label: "پنل مدیریت" }]
                  : section.items
                ).map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} onClick={closeOnMobile} className="flex items-center gap-2"
                        activeClassName="bg-accent text-accent-foreground font-medium">
                        <item.icon className="w-4 h-4" />
                        {!collapsed && <span>{tr(item.label)}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </CollapsibleContent>
        </Collapsible>
      </SidebarGroup>
    );
  };

  const renderFolders = (dragHandle: any) => (
    <SidebarGroup>
      <Collapsible open={(openSections["__folders"] ?? true) || collapsed} onOpenChange={(v) => setSection("__folders", v)}>
        {!collapsed && (
          <SidebarGroupLabel className="flex justify-between items-center pe-1">
            {dragHandle && (
              <button {...dragHandle} className="cursor-grab active:cursor-grabbing p-0.5 opacity-30 hover:opacity-80 transition">
                <GripVertical className="w-3 h-3" />
              </button>
            )}
            <CollapsibleTrigger className="flex items-center gap-2 flex-1 hover:bg-sidebar-accent/50 rounded transition">
              <FolderTree className="w-3.5 h-3.5 text-muted-foreground" />
              <span>فولدرها</span>
              <ChevronDown className={`w-3.5 h-3.5 me-auto text-muted-foreground transition-transform ${(openSections["__folders"] ?? true) ? "" : "-rotate-90"}`} />
            </CollapsibleTrigger>
            <Dialog open={openFolderDlg} onOpenChange={setOpenFolderDlg}>
              <DialogTrigger asChild>
                <button className="hover:bg-muted rounded p-0.5"><Plus className="w-3 h-3" /></button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>فولدر جدید</DialogTitle></DialogHeader>
                <Input placeholder="نام فولدر" value={newFolder} onChange={(e) => setNewFolder(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createFolder()} />
                <DialogFooter><Button onClick={createFolder}>ایجاد</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </SidebarGroupLabel>
        )}
        <CollapsibleContent forceMount={collapsed ? true : undefined}>
          <SidebarGroupContent>
            <SidebarMenu>{renderTree(null)}</SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  );

  const renderTags = (dragHandle: any) => (
    <SidebarGroup>
      <Collapsible open={(openSections["__tags"] ?? false) || collapsed} onOpenChange={(v) => setSection("__tags", v)}>
        {!collapsed && (
          <SidebarGroupLabel className="flex justify-between items-center pe-1">
            {dragHandle && (
              <button {...dragHandle} className="cursor-grab active:cursor-grabbing p-0.5 opacity-30 hover:opacity-80 transition">
                <GripVertical className="w-3 h-3" />
              </button>
            )}
            <CollapsibleTrigger className="flex items-center gap-2 flex-1 hover:bg-sidebar-accent/50 rounded transition">
              <Tag className="w-3.5 h-3.5 text-muted-foreground" />
              <span>تگ‌ها</span>
              <ChevronDown className={`w-3.5 h-3.5 me-auto text-muted-foreground transition-transform ${(openSections["__tags"] ?? false) ? "" : "-rotate-90"}`} />
            </CollapsibleTrigger>
            <Dialog open={openTagDlg} onOpenChange={setOpenTagDlg}>
              <DialogTrigger asChild>
                <button className="hover:bg-muted rounded p-0.5"><Plus className="w-3 h-3" /></button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>تگ جدید</DialogTitle></DialogHeader>
                <Input placeholder="نام تگ" value={newTag} onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createTag()} />
                <DialogFooter><Button onClick={createTag}>ایجاد</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </SidebarGroupLabel>
        )}
        <CollapsibleContent forceMount={collapsed ? true : undefined}>
          <SidebarGroupContent>
            <SidebarMenu>
              {tags.map((t) => (
                <TagRow key={t.id} tag={t} collapsed={collapsed}
                  onLongPress={() => setSheetTag(t)}
                  onNav={closeOnMobile} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  );

  const renderBlock = (id: string, dragHandle: any) => {
    if (id === "__folders") return renderFolders(dragHandle);
    if (id === "__tags") return renderTags(dragHandle);
    const sec = SECTIONS.find((s) => s.id === id);
    if (!sec) return null;
    return renderSection(sec, dragHandle);
  };

  return (
    <Sidebar side="right" collapsible="offcanvas">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-1">
          <img src="/favicon.png" alt="ARSHNAZ" className="w-8 h-8 rounded-lg shrink-0" loading="lazy" width={32} height={32} />
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-base bg-gradient-to-l from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">ARSHNAZ</span>
              <span className="text-[9px] text-muted-foreground">{t("app.tagline")}</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Daily progress replaces the old Home link at the top of the sidebar */}
        {collapsed ? (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/app/stats"
                      onClick={closeOnMobile}
                      className="flex items-center gap-2"
                      activeClassName="bg-accent text-accent-foreground font-medium"
                    >
                      <Flame className="w-4 h-4 text-primary" />
                      <span className="sr-only">پیشرفت روزانه</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <div className="px-3 py-2">
            <NavLink
              to="/app/stats"
              onClick={closeOnMobile}
              className="block"
              activeClassName=""
            >
              <StreakCard />
            </NavLink>
          </div>
        )}

        {collapsed ? (
          // collapsed: render in default order, no drag
          DEFAULT_ORDER.map((id) => <div key={id}>{renderBlock(id, null)}</div>)
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={order} strategy={verticalListSortingStrategy}>
              {order.map((id) => (
                <SortableBlock key={id} id={id}>
                  {(handleProps) => renderBlock(id, handleProps)}
                </SortableBlock>
              ))}
            </SortableContext>
          </DndContext>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink
                to="/app/settings"
                onClick={closeOnMobile}
                className="flex items-center gap-2"
                activeClassName="bg-accent text-accent-foreground font-medium"
              >
                <Settings className="w-4 h-4" />
                {!collapsed && <span>{tr("تنظیمات")}</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {!collapsed && (
          <Button variant="ghost" size="sm" onClick={resetOrder} className="justify-start text-xs opacity-70">
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="ms-2">بازنشانی ترتیب</span>
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => { signOut(); toast.success("خروج موفق"); }} className="justify-start">
          <LogOut className="w-4 h-4" />
          {!collapsed && <span className="ms-2">خروج</span>}
        </Button>
      </SidebarFooter>
      {aiFolder && (
        <FolderAIChat
          open={!!aiFolder}
          onOpenChange={(v) => !v && setAiFolder(null)}
          folderId={aiFolder.id}
          folderName={aiFolder.name}
        />
      )}
      {delFolder && (
        <FolderDeleteDialog
          open={!!delFolder}
          onOpenChange={(v) => !v && setDelFolder(null)}
          folderId={delFolder.id}
          folderName={delFolder.name}
          onDone={load}
        />
      )}
      {delTag && (
        <TagDeleteDialog
          open={!!delTag}
          onOpenChange={(v) => !v && setDelTag(null)}
          tagId={delTag.id}
          tagName={delTag.name}
          onDone={load}
        />
      )}
      <SidebarItemSheet
        item={sheetFolder}
        kind="folder"
        onOpenChange={(v) => !v && setSheetFolder(null)}
        onDelete={() => sheetFolder && setDelFolder(sheetFolder)}
        onAIChat={() => sheetFolder && setAiFolder(sheetFolder)}
        onChanged={load}
      />
      <SidebarItemSheet
        item={sheetTag}
        kind="tag"
        onOpenChange={(v) => !v && setSheetTag(null)}
        onDelete={() => sheetTag && setDelTag(sheetTag)}
        onChanged={load}
      />
    </Sidebar>
  );
}
