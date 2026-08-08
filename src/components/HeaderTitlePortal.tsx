import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BidiText } from "@/components/BidiText";

/** Renders the page title into the sticky app header (next to the search icon). */
export function HeaderTitlePortal({ title }: { title: string }) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHost(document.getElementById("app-header-title"));
  }, []);

  if (!host) return null;
  return createPortal(
    <BidiText
      as="h1"
      text={title}
      className="text-base sm:text-lg font-bold truncate max-w-[45vw]"
    />,
    host
  );
}
