import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TaskDetail } from "@/components/TaskDetail";
import type { Task, ConfirmState } from "@/lib/taskTypes";
import { Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function TaskDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const load = async () => {
    if (!id) return;
    const { data } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
    if (data) setTask(data as any);
    else setTask(null);
  };

  useEffect(() => { load(); }, [id]);

  if (!task) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <>
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
