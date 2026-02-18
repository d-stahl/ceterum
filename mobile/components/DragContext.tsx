import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { WorkerType, OratorRole } from '../lib/game-engine/workers';

export type DropTarget = {
  id: string;
  bounds: { x: number; y: number; width: number; height: number };
  accepts: WorkerType[];
  oratorRole?: OratorRole;
};

export type PreliminaryPlacement = {
  targetId: string;
  workerType: WorkerType;
  oratorRole?: OratorRole;
  factionKey: string;
};

type DragState = {
  isDragging: boolean;
  dragWorkerType: WorkerType | null;
  dragPosition: { x: number; y: number };
  highlightedTargets: Set<string>;
  hoveredTarget: string | null;
  preliminaryPlacement: PreliminaryPlacement | null;
};

type DragContextType = DragState & {
  startDrag: (workerType: WorkerType, x: number, y: number) => void;
  updateDrag: (x: number, y: number) => void;
  endDrag: (x: number, y: number) => void;
  registerTarget: (target: DropTarget) => void;
  unregisterTarget: (id: string) => void;
  clearPreliminary: () => void;
  scrollOffset: React.MutableRefObject<number>;
};

const DragContext = createContext<DragContextType | null>(null);

export function useDrag(): DragContextType {
  const ctx = useContext(DragContext);
  if (!ctx) throw new Error('useDrag must be used inside DragProvider');
  return ctx;
}

export function DragProvider({ children }: { children: React.ReactNode }) {
  const targetsRef = useRef<Map<string, DropTarget>>(new Map());
  const scrollOffset = useRef(0);

  const [state, setState] = useState<DragState>({
    isDragging: false,
    dragWorkerType: null,
    dragPosition: { x: 0, y: 0 },
    highlightedTargets: new Set(),
    hoveredTarget: null,
    preliminaryPlacement: null,
  });

  const hitTest = useCallback((x: number, y: number, workerType: WorkerType): DropTarget | null => {
    for (const target of targetsRef.current.values()) {
      if (!target.accepts.includes(workerType)) continue;
      const { bounds } = target;
      if (
        x >= bounds.x &&
        x <= bounds.x + bounds.width &&
        y >= bounds.y &&
        y <= bounds.y + bounds.height
      ) {
        return target;
      }
    }
    return null;
  }, []);

  const computeHighlights = useCallback((workerType: WorkerType): Set<string> => {
    const highlighted = new Set<string>();
    for (const target of targetsRef.current.values()) {
      if (target.accepts.includes(workerType)) {
        highlighted.add(target.id);
      }
    }
    return highlighted;
  }, []);

  const startDrag = useCallback((workerType: WorkerType, x: number, y: number) => {
    setState((prev) => ({
      ...prev,
      isDragging: true,
      dragWorkerType: workerType,
      dragPosition: { x, y },
      highlightedTargets: computeHighlights(workerType),
      hoveredTarget: null,
      // Don't clear preliminary here — clearing it unmounts the DraggableWorker
      // mid-gesture when picking up a preliminary placement. endDrag handles it.
    }));
  }, [computeHighlights]);

  const updateDrag = useCallback((x: number, y: number) => {
    setState((prev) => {
      if (!prev.dragWorkerType) return { ...prev, dragPosition: { x, y } };
      const target = hitTest(x, y, prev.dragWorkerType);
      return {
        ...prev,
        dragPosition: { x, y },
        hoveredTarget: target?.id ?? null,
      };
    });
  }, [hitTest]);

  const endDrag = useCallback((x: number, y: number) => {
    setState((prev) => {
      const workerType = prev.dragWorkerType;
      if (!workerType) {
        return { ...prev, isDragging: false, dragWorkerType: null, highlightedTargets: new Set(), hoveredTarget: null };
      }

      const target = hitTest(x, y, workerType);
      const preliminary: PreliminaryPlacement | null = target
        ? {
            targetId: target.id,
            workerType,
            oratorRole: target.oratorRole,
            factionKey: target.id.split(':')[1] ?? '',
          }
        : null;

      return {
        ...prev,
        isDragging: false,
        dragWorkerType: null,
        highlightedTargets: new Set(),
        hoveredTarget: null,
        preliminaryPlacement: preliminary,
      };
    });
  }, [hitTest]);

  const registerTarget = useCallback((target: DropTarget) => {
    targetsRef.current.set(target.id, target);
    // Recompute highlights if currently dragging (e.g. faction auto-expanded)
    setState((prev) => {
      if (!prev.isDragging || !prev.dragWorkerType) return prev;
      return { ...prev, highlightedTargets: computeHighlights(prev.dragWorkerType) };
    });
  }, [computeHighlights]);

  const unregisterTarget = useCallback((id: string) => {
    targetsRef.current.delete(id);
  }, []);

  const clearPreliminary = useCallback(() => {
    setState((prev) => ({ ...prev, preliminaryPlacement: null }));
  }, []);

  return (
    <DragContext.Provider
      value={{
        ...state,
        startDrag,
        updateDrag,
        endDrag,
        registerTarget,
        unregisterTarget,
        clearPreliminary,
        scrollOffset,
      }}
    >
      {children}
    </DragContext.Provider>
  );
}
