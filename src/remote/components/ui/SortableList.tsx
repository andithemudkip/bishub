import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { GripIcon, ChevronUpIcon, ChevronDownIcon } from "../icons/ui";

interface Rect {
  top: number;
  height: number;
}

interface DragState {
  id: string;
  startY: number;
  order: string[];
  originalOrder: string[];
  rects: Map<string, Rect>;
  handleEl: HTMLElement;
  pointerId: number;
  onMove: (e: PointerEvent) => void;
  onUp: () => void;
  onCancel: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
}

interface SortableListProps<T> {
  items: T[];
  getId: (item: T) => string;
  onReorder: (orderedIds: string[]) => void;
  renderItem: (item: T, index: number) => ReactNode;
  moveUpLabel: string;
  moveDownLabel: string;
  className?: string;
  /** Id of the row to mark as currently playing. */
  highlightId?: string | null;
}

/**
 * Hand-rolled drag-and-drop list using Pointer Events — no dependency added.
 * Dragging starts only from the grip handle; ↑/↓ buttons cover the same
 * reorder without a drag, for keyboard/touch accessibility.
 */
export function SortableList<T>({
  items,
  getId,
  onReorder,
  renderItem,
  moveUpLabel,
  moveDownLabel,
  className = "",
  highlightId = null,
}: SortableListProps<T>) {
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dragRef = useRef<DragState | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [liveOrder, setLiveOrder] = useState<string[] | null>(null);
  const [offsetY, setOffsetY] = useState(0);

  const ids = items.map(getId);
  const displayOrder = liveOrder ?? ids;
  const itemById = new Map(items.map((it) => [getId(it), it]));

  // Release the held order once the parent's items match it — or once they
  // diverge by an add/remove, which means the held order is stale.
  const idsKey = ids.join("|");
  useEffect(() => {
    setLiveOrder((prev) => {
      if (!prev || dragRef.current) return prev;
      const current = idsKey.split("|");
      const settled =
        prev.length === current.length && prev.every((id, i) => id === current[i]);
      const sameSet =
        prev.length === current.length && prev.every((id) => current.includes(id));
      return settled || !sameSet ? null : prev;
    });
  }, [idsKey]);

  const cleanupDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    drag.handleEl.removeEventListener("pointermove", drag.onMove);
    drag.handleEl.removeEventListener("pointerup", drag.onUp);
    drag.handleEl.removeEventListener("pointercancel", drag.onCancel);
    window.removeEventListener("keydown", drag.onKeyDown);
    try {
      drag.handleEl.releasePointerCapture(drag.pointerId);
    } catch {
      // Pointer capture may already be released — safe to ignore.
    }
    dragRef.current = null;
  }, []);

  const endDrag = useCallback(
    (commit: boolean) => {
      const drag = dragRef.current;
      cleanupDrag();
      setDragId(null);
      setOffsetY(0);
      if (commit && drag) {
        // Hold the dropped order on screen until the parent's items catch up.
        // Clearing now would flash the pre-drag order for a frame while the
        // reorder round-trips through the main process.
        setLiveOrder(drag.order);
        onReorder(drag.order);
      } else {
        setLiveOrder(null);
      }
    },
    [cleanupDrag, onReorder]
  );

  const startDrag = useCallback(
    (id: string, e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const rects = new Map<string, Rect>();
      for (const itemId of ids) {
        const el = rowRefs.current.get(itemId);
        if (el) {
          const r = el.getBoundingClientRect();
          rects.set(itemId, { top: r.top, height: r.height });
        }
      }

      const handleEl = e.currentTarget;
      const pointerId = e.pointerId;

      const onMove = (moveEvent: PointerEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        const deltaY = moveEvent.clientY - drag.startY;

        const draggedRect = drag.rects.get(drag.id);
        if (!draggedRect) return;
        const draggedCenter = draggedRect.top + draggedRect.height / 2 + deltaY;

        const others = drag.originalOrder.filter((itemId) => itemId !== drag.id);
        let insertIndex = others.length;
        for (let i = 0; i < others.length; i++) {
          const rect = drag.rects.get(others[i]);
          if (!rect) continue;
          if (draggedCenter < rect.top + rect.height / 2) {
            insertIndex = i;
            break;
          }
        }
        const newOrder = [...others];
        newOrder.splice(insertIndex, 0, drag.id);
        drag.order = newOrder;
        setLiveOrder(newOrder);

        // Reordering re-renders the dragged row into its new slot, so applying
        // the raw pointer delta on top would double-count the move and make the
        // row jump a whole slot each time it passes another item. Subtract the
        // slot shift so it keeps tracking the pointer continuously.
        const slotTops = drag.originalOrder.map(
          (itemId) => drag.rects.get(itemId)?.top ?? 0
        );
        const fromSlot = drag.originalOrder.indexOf(drag.id);
        const toSlot = newOrder.indexOf(drag.id);
        const slotShift = (slotTops[toSlot] ?? 0) - (slotTops[fromSlot] ?? 0);
        setOffsetY(deltaY - slotShift);
      };

      const onUp = () => endDrag(true);
      const onCancel = () => endDrag(false);
      const onKeyDown = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key === "Escape") endDrag(false);
      };

      dragRef.current = {
        id,
        startY: e.clientY,
        order: ids,
        originalOrder: ids,
        rects,
        handleEl,
        pointerId,
        onMove,
        onUp,
        onCancel,
        onKeyDown,
      };

      handleEl.setPointerCapture(pointerId);
      handleEl.addEventListener("pointermove", onMove);
      handleEl.addEventListener("pointerup", onUp);
      handleEl.addEventListener("pointercancel", onCancel);
      window.addEventListener("keydown", onKeyDown);

      setDragId(id);
      setLiveOrder(ids);
      setOffsetY(0);
    },
    [ids, endDrag]
  );

  const moveBy = (id: string, delta: number) => {
    const index = ids.indexOf(id);
    const targetIndex = index + delta;
    if (targetIndex < 0 || targetIndex >= ids.length) return;
    const reordered = [...ids];
    [reordered[index], reordered[targetIndex]] = [
      reordered[targetIndex],
      reordered[index],
    ];
    onReorder(reordered);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {displayOrder.map((id) => {
        const item = itemById.get(id);
        if (!item) return null;
        const index = ids.indexOf(id);
        const isDragging = dragId === id;

        return (
          <div
            key={id}
            ref={(el) => {
              if (el) rowRefs.current.set(id, el);
              else rowRefs.current.delete(id);
            }}
            className={`flex items-center gap-2 border rounded-lg p-2 transition-colors ${
              isDragging
                ? "bg-gray-900/50 border-blue-500/50 shadow-lg relative z-10"
                : id === highlightId
                  ? "bg-blue-950/20 border-blue-500/40"
                  : "bg-gray-900/50 border-gray-700/30"
            }`}
            style={
              isDragging
                ? { transform: `translateY(${offsetY}px)`, touchAction: "none" }
                : undefined
            }
          >
            <button
              type="button"
              onPointerDown={(e) => startDrag(id, e)}
              className="p-1.5 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 cursor-grab active:cursor-grabbing transition-colors flex-shrink-0"
              style={{ touchAction: "none" }}
              aria-label="Drag to reorder"
            >
              <GripIcon className="w-4 h-4" />
            </button>

            <div className="flex-1 min-w-0">{renderItem(item, index)}</div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => moveBy(id, -1)}
                disabled={index === 0}
                className="p-1.5 rounded hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label={moveUpLabel}
                title={moveUpLabel}
              >
                <ChevronUpIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => moveBy(id, 1)}
                disabled={index === ids.length - 1}
                className="p-1.5 rounded hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label={moveDownLabel}
                title={moveDownLabel}
              >
                <ChevronDownIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
