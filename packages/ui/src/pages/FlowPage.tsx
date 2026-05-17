import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node as RFNode,
  type Edge as RFEdge,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { api } from "../api/client.ts";
import type { Flow, Run } from "@flowmap/shared";
import FlowNode from "../components/FlowNode.tsx";

const nodeTypes = { flowNode: FlowNode };

export default function FlowPage() {
  const { projectId, flowId } = useParams<{ projectId: string; flowId: string }>();

  const [flow, setFlow] = useState<Flow | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [triggering, setTriggering] = useState(false);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<RFNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<RFEdge>([]);

  useEffect(() => {
    if (!flowId) return;
    api.getFlow(flowId).then((f) => {
      setFlow(f);
      setNodes(toRFNodes(f));
      setEdges(toRFEdges(f));
    });
    api.listRuns(flowId).then(setRuns).catch(console.error);
  }, [flowId]);

  async function handleTrigger(mode: "ai" | "manual") {
    if (!flowId) return;
    setTriggering(true);
    setError(null);
    try {
      const run = await api.triggerRun(flowId, mode);
      setRuns((prev) => [run, ...prev]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTriggering(false);
    }
  }

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: RFEdge) => {
    setSelectedEdge(edge.id === selectedEdge ? null : edge.id);
  }, [selectedEdge]);

  async function toggleObserve(edgeId: string) {
    if (!flowId || !flow) return;
    const edge = flow.edges.find((e) => e.id === edgeId);
    if (!edge) return;

    const nextObserved = !edge.observed;

    const patchEdges = (f: Flow | null, val: boolean): Flow | null =>
      f ? { ...f, edges: f.edges.map((e) => e.id === edgeId ? { ...e, observed: val } : e) } : f;

    // Optimistic update
    setFlow((f) => patchEdges(f, nextObserved));
    setEdges(toRFEdges(patchEdges(flow, nextObserved)!));

    try {
      await api.setEdgeObserved(flowId, edgeId, nextObserved);
    } catch (err: any) {
      // Rollback on failure
      setFlow((f) => patchEdges(f, edge.observed));
      setEdges(toRFEdges(patchEdges(flow, edge.observed)!));
      setError(`Failed to update edge: ${err.message}`);
    }
  }

  if (!flow) return <div style={styles.loading}>Loading flow…</div>;

  const selectedFlowEdge = selectedEdge ? flow.edges.find((e) => e.id === selectedEdge) : null;

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.breadcrumb}>
          <Link to="/projects" style={styles.link}>Projects</Link>
          <span style={styles.sep}>/</span>
          <Link to={`/projects/${projectId}`} style={styles.link}>Project</Link>
          <span style={styles.sep}>/</span>
          <span>{flow.name}</span>
        </div>
        <div style={styles.actions}>
          {error && <span style={styles.error}>{error}</span>}
          <button style={styles.btnSecondary} onClick={() => handleTrigger("manual")} disabled={triggering}>
            {triggering ? "Triggering…" : "Manual trigger"}
          </button>
          <button style={styles.btn} onClick={() => handleTrigger("ai")} disabled={triggering}>
            {triggering ? "…" : "AI trigger"}
          </button>
        </div>
      </div>

      {/* Canvas + side panel */}
      <div style={styles.workspace}>
        <div style={styles.canvas}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onEdgeClick={onEdgeClick}
            nodeTypes={nodeTypes}
            fitView
            colorMode="dark"
          >
            <Background variant={BackgroundVariant.Dots} color="#333" />
            <Controls />
            <MiniMap nodeColor="#333" maskColor="rgba(0,0,0,0.7)" />
          </ReactFlow>
        </div>

        {/* Side panel */}
        <div style={styles.panel}>
          {selectedFlowEdge ? (
            <div>
              <h3 style={styles.panelTitle}>Edge</h3>
              <p style={styles.panelSub}>{selectedFlowEdge.from} → {selectedFlowEdge.to}</p>
              <div style={styles.panelRow}>
                <span style={styles.panelLabel}>Type</span>
                <code style={styles.code}>{selectedFlowEdge.data_type}</code>
              </div>
              <div style={styles.panelRow}>
                <span style={styles.panelLabel}>Key fields</span>
                <div>{selectedFlowEdge.key_fields.map((f) => (
                  <div key={f}><code style={styles.code}>{f}</code></div>
                ))}</div>
              </div>
              <div style={styles.panelRow}>
                <span style={styles.panelLabel}>Observe</span>
                <button
                  style={selectedFlowEdge.observed ? styles.observeOn : styles.observeOff}
                  onClick={() => toggleObserve(selectedFlowEdge.id)}
                >
                  {selectedFlowEdge.observed ? "Watching" : "Watch"}
                </button>
              </div>
              {selectedFlowEdge.snapshot && (
                <div style={{ marginTop: 16 }}>
                  <p style={styles.panelLabel}>Last snapshot</p>
                  <pre style={styles.pre}>{JSON.stringify(selectedFlowEdge.snapshot.values, null, 2)}</pre>
                </div>
              )}
            </div>
          ) : (
            <div>
              <h3 style={styles.panelTitle}>Flow info</h3>
              <div style={styles.panelRow}>
                <span style={styles.panelLabel}>Nodes</span>
                <span>{flow.nodes.length}</span>
              </div>
              <div style={styles.panelRow}>
                <span style={styles.panelLabel}>Edges</span>
                <span>{flow.edges.length}</span>
              </div>
              <div style={styles.panelRow}>
                <span style={styles.panelLabel}>Confidence</span>
                <span>{Math.round(flow.meta.confidence * 100)}%</span>
              </div>
              <div style={styles.panelRow}>
                <span style={styles.panelLabel}>Source</span>
                <span>{flow.meta.source}</span>
              </div>
              {flow.meta.tags.length > 0 && (
                <div style={styles.panelRow}>
                  <span style={styles.panelLabel}>Tags</span>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {flow.meta.tags.map((t) => <span key={t} style={styles.tag}>{t}</span>)}
                  </div>
                </div>
              )}

              {/* Recent runs */}
              {runs.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <p style={styles.panelLabel}>Recent runs</p>
                  {runs.slice(0, 5).map((r) => (
                    <div key={r.id} style={styles.runRow}>
                      <span style={{ ...styles.statusDot, background: statusColor(r.status) }} />
                      <span style={styles.runMode}>{r.trigger_mode}</span>
                      <span style={styles.runTime}>{new Date(r.started_at).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function toRFNodes(flow: Flow): RFNode[] {
  const COLS = 3;
  return flow.nodes.map((n, i) => ({
    id: n.id,
    type: "flowNode",
    position: { x: (i % COLS) * 260, y: Math.floor(i / COLS) * 140 },
    data: { node: n },
  }));
}

function toRFEdges(flow: Flow): RFEdge[] {
  return flow.edges.map((e) => ({
    id: e.id,
    source: e.from,
    target: e.to,
    label: e.data_type,
    style: {
      stroke: e.observed ? "#60a5fa" : "#444",
      strokeWidth: e.observed ? 2 : 1,
    },
    labelStyle: { fill: "#888", fontSize: 11 },
    animated: e.observed,
  }));
}

function statusColor(status: Run["status"]) {
  return status === "completed" ? "#4ade80" : status === "failed" ? "#f87171" : status === "running" ? "#60a5fa" : "#888";
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: "flex", flexDirection: "column", height: "100vh" },
  loading: { padding: 48, color: "#666" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderBottom: "1px solid #222", flexShrink: 0 },
  breadcrumb: { display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#666" },
  link: { color: "#888", textDecoration: "none" },
  sep: { color: "#444" },
  actions: { display: "flex", gap: 8, alignItems: "center" },
  btn: { background: "#fff", color: "#000", border: "none", borderRadius: 8, padding: "7px 14px", fontWeight: 600, cursor: "pointer", fontSize: 13 },
  btnSecondary: { background: "transparent", color: "#e5e5e5", border: "1px solid #333", borderRadius: 8, padding: "7px 14px", fontWeight: 600, cursor: "pointer", fontSize: 13 },
  error: { color: "#f87171", fontSize: 12 },
  workspace: { display: "flex", flex: 1, overflow: "hidden" },
  canvas: { flex: 1, height: "100%" },
  panel: { width: 280, borderLeft: "1px solid #222", padding: 20, overflowY: "auto", flexShrink: 0 },
  panelTitle: { fontSize: 15, fontWeight: 600, marginBottom: 4 },
  panelSub: { fontSize: 12, color: "#666", marginBottom: 16, fontFamily: "monospace" },
  panelRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 12, fontSize: 13 },
  panelLabel: { color: "#666", fontSize: 12, marginBottom: 4 },
  code: { fontFamily: "monospace", fontSize: 12, color: "#a5f3fc", background: "#0f2027", padding: "1px 5px", borderRadius: 3 },
  pre: { fontFamily: "monospace", fontSize: 11, color: "#a5f3fc", background: "#0f2027", padding: 10, borderRadius: 6, overflowX: "auto", whiteSpace: "pre-wrap" },
  observeOn: { background: "#1e40af", color: "#93c5fd", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 },
  observeOff: { background: "#222", color: "#888", border: "1px solid #333", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12 },
  tag: { background: "#1a2a1a", color: "#86efac", fontSize: 11, padding: "2px 7px", borderRadius: 4 },
  runRow: { display: "flex", gap: 8, alignItems: "center", padding: "6px 0", borderBottom: "1px solid #1a1a1a" },
  statusDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  runMode: { fontSize: 12, color: "#aaa" },
  runTime: { fontSize: 11, color: "#666", marginLeft: "auto" },
};
