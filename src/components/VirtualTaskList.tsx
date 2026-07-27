import { useVirtualizer } from "@tanstack/react-virtual";
import type { CSSProperties, ReactNode } from "react";

interface VirtualTaskListProps {
  itemIds: string[];
  renderItem: (id: string) => ReactNode;
}

function VirtualTaskRow({
  index,
  virtualRef,
  virtualStyle,
  children,
}: {
  index: number;
  virtualRef: (el: HTMLElement | null) => void;
  virtualStyle: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div data-index={index} ref={(node) => virtualRef(node)} style={virtualStyle}>
      {children}
    </div>
  );
}

export function VirtualTaskList({ itemIds, renderItem }: VirtualTaskListProps) {
  const virtualizer = useVirtualizer({
    count: itemIds.length,
    getScrollElement: () => document.getElementById("main-scroll") ?? undefined,
    estimateSize: () => 60,
    overscan: 5,
    getItemKey: (index) => itemIds[index] ?? index,
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div style={{ position: "relative", width: "100%", height: `${virtualizer.getTotalSize()}px` }}>
      {virtualItems.map((virtualItem) => {
        const id = itemIds[virtualItem.index];
        if (!id) return null;
        const virtualStyle: CSSProperties = {
          position: "absolute",
          top: virtualItem.start,
          left: 0,
          width: "100%",
        };
        return (
          <VirtualTaskRow
            key={virtualItem.key}
            index={virtualItem.index}
            virtualRef={(el) => virtualizer.measureElement(el)}
            virtualStyle={virtualStyle}
          >
            {renderItem(id)}
          </VirtualTaskRow>
        );
      })}
    </div>
  );
}
