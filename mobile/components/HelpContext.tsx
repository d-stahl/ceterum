import React, { createContext, useContext, useRef, useState, useCallback } from 'react';

type Bounds = { x: number; y: number; width: number; height: number };

export type HelpTargetEntry = {
  uniqueKey: string;
  helpId: string;
  bounds: Bounds;
};

type HelpContextType = {
  activeHelpId: string | null;
  hoveredHelpId: string | null;
  hoveredUniqueKey: string | null;
  isHelpDragging: boolean;
  helpDragPosition: { x: number; y: number };
  openGeneralHelp: () => void;
  openHelp: (id: string) => void;
  dismissHelp: () => void;
  startHelpDrag: (x: number, y: number) => void;
  updateHelpDrag: (x: number, y: number) => void;
  endHelpDrag: (x: number, y: number) => void;
  registerHelpTarget: (target: HelpTargetEntry) => void;
  unregisterHelpTarget: (uniqueKey: string) => void;
};

const HelpContext = createContext<HelpContextType | null>(null);

export function useHelp(): HelpContextType | null {
  return useContext(HelpContext);
}

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const targetsRef = useRef<Map<string, HelpTargetEntry>>(new Map());
  const [activeHelpId, setActiveHelpId] = useState<string | null>(null);
  const [hoveredHelpId, setHoveredHelpId] = useState<string | null>(null);
  const [hoveredUniqueKey, setHoveredUniqueKey] = useState<string | null>(null);
  const [isHelpDragging, setIsHelpDragging] = useState(false);
  const [helpDragPosition, setHelpDragPosition] = useState({ x: 0, y: 0 });

  const hitTest = useCallback((x: number, y: number): { helpId: string; uniqueKey: string } | null => {
    for (const target of targetsRef.current.values()) {
      const { bounds } = target;
      if (
        x >= bounds.x && x <= bounds.x + bounds.width &&
        y >= bounds.y && y <= bounds.y + bounds.height
      ) {
        return { helpId: target.helpId, uniqueKey: target.uniqueKey };
      }
    }
    return null;
  }, []);

  const openGeneralHelp = useCallback(() => setActiveHelpId('general'), []);
  const openHelp = useCallback((id: string) => setActiveHelpId(id), []);
  const dismissHelp = useCallback(() => {
    setActiveHelpId(null);
    setHoveredHelpId(null);
    setHoveredUniqueKey(null);
  }, []);

  const startHelpDrag = useCallback((x: number, y: number) => {
    setIsHelpDragging(true);
    setHelpDragPosition({ x, y });
    setHoveredHelpId(null);
    setHoveredUniqueKey(null);
  }, []);

  const updateHelpDrag = useCallback((x: number, y: number) => {
    setHelpDragPosition({ x, y });
    const hit = hitTest(x, y);
    setHoveredHelpId(hit?.helpId ?? null);
    setHoveredUniqueKey(hit?.uniqueKey ?? null);
  }, [hitTest]);

  const endHelpDrag = useCallback((x: number, y: number) => {
    setIsHelpDragging(false);
    const hit = hitTest(x, y);
    setHoveredHelpId(null);
    setHoveredUniqueKey(null);
    if (hit) setActiveHelpId(hit.helpId);
  }, [hitTest]);

  const registerHelpTarget = useCallback((target: HelpTargetEntry) => {
    targetsRef.current.set(target.uniqueKey, target);
  }, []);

  const unregisterHelpTarget = useCallback((uniqueKey: string) => {
    targetsRef.current.delete(uniqueKey);
  }, []);

  return (
    <HelpContext.Provider value={{
      activeHelpId,
      hoveredHelpId,
      hoveredUniqueKey,
      isHelpDragging,
      helpDragPosition,
      openGeneralHelp,
      openHelp,
      dismissHelp,
      startHelpDrag,
      updateHelpDrag,
      endHelpDrag,
      registerHelpTarget,
      unregisterHelpTarget,
    }}>
      {children}
    </HelpContext.Provider>
  );
}
