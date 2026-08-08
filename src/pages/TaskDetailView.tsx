import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TaskDetail } from "@/components/TaskDetail";
import type { Task, ConfirmState } from "@/lib/taskTypes";
import { Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cacheGet } from "@/lib/offlineQueue";
import { useTranslation } from "react-i18next";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function TaskDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const isEn = (i18n.language || "fa").startsWith("en");
  const T = (fa: string, en: string) => (isEn ? en : fa);
  const [task, setTask] = useState<Task | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const load = async () => {
    if (!id) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const cached = user ? await cacheGet<Task[]>(`tasks:all:${user.id}`) : null;
      const match = cached?.find(t => t.id === id);
      if (match) { setTask(match); return; }
      setTask(null);
      return;
    }
    try {
      const { data } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
      if (data) setTask(data as unknown as Task);
      else setTask(null);
    } catch {
      const cached = user ? await cacheGet<Task[]>(`tasks:all:${user.id}`) : null;
      const match = cached?.find(t => t.id === id);
      setTask(match || null);
    }
  };

  useEffect(() => { load(); }, [id, user]);

  if (!task) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b flex items-center justify-between gap-2 p-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1">
          <ArrowRight className="w-4 h-4" /> {T("برگشت", "Back")}
        </Button>
        <h1 className="text-base font-bold flex-1 text-center truncate px-2" dir="auto">
          {task.title || T("بدون عنوان", "Untitled")}
        </h1>
        <div className="w-20" />
      </div>
      <TaskDetail
        task={task}
        onClose={() => navigate(-1)}
        onChanged={load}
        setConfirm={setConfirm}
        mode="page"
        allowDelete
      />
      <AlertDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "task" ? "حذف تسک؟" : confirm?.kind === "note" ? "حذف نوت؟" : "حذف زیرتسک؟"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              آیا مطمئنی می‌خوای «{confirm?.title}» را حذف کنی؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (confirm) await confirm.onConfirm();
                setConfirm(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
