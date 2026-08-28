export interface FolderPrefs {
  view: "list" | "kanban-stream" | "kanban-columns";
  bgColor: string | null;
  bgImage: string | null;
  sortOrder: "manual" | "priority" | "due_date" | "alphabetical";
}

export const DEFAULT_FOLDER_PREFS: FolderPrefs = {
  view: "list",
  bgColor: null,
  bgImage: null,
  sortOrder: "manual",
};

const storageKey = (folderId: string, userId?: string) =>
  `arshnaz_folder_prefs_v1_${folderId}${userId ? `_${userId}` : ""}`;

export function getFolderPrefs(folderId: string, userId?: string): FolderPrefs {
  try {
    const raw = localStorage.getItem(storageKey(folderId, userId));
    if (!raw) return { ...DEFAULT_FOLDER_PREFS };

    const parsed = JSON.parse(raw) as Partial<FolderPrefs>;
    const view =
      parsed.view === "kanban-stream" || parsed.view === "kanban-columns" || parsed.view === "list"
        ? parsed.view
        : DEFAULT_FOLDER_PREFS.view;
    const sortOrder =
      parsed.sortOrder === "priority" ||
      parsed.sortOrder === "due_date" ||
      parsed.sortOrder === "alphabetical" ||
      parsed.sortOrder === "manual"
        ? parsed.sortOrder
        : DEFAULT_FOLDER_PREFS.sortOrder;

    return {
      view,
      bgColor: typeof parsed.bgColor === "string" ? parsed.bgColor : null,
      bgImage: typeof parsed.bgImage === "string" ? parsed.bgImage : null,
      sortOrder,
    };
  } catch {
    return { ...DEFAULT_FOLDER_PREFS };
  }
}

export function saveFolderPrefs(folderId: string, prefs: FolderPrefs, userId?: string) {
  try {
    localStorage.setItem(storageKey(folderId, userId), JSON.stringify(prefs));
    window.dispatchEvent(
      new CustomEvent("arshnaz-folder-prefs-updated", {
        detail: { folderId, userId, prefs },
      }),
    );
  } catch (e) {
    console.error("Failed to save folder preferences:", e);
  }
}
