import { create } from "zustand";

interface UIState {
  selectedEdgeId: string | null;
  selectedNodeId: string | null;
  setSelectedEdge: (id: string | null) => void;
  setSelectedNode: (id: string | null) => void;
  clearSelection: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedEdgeId: null,
  selectedNodeId: null,
  setSelectedEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),
  setSelectedNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
  clearSelection: () => set({ selectedEdgeId: null, selectedNodeId: null }),
}));
