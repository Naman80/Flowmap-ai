import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../api/client.ts";
import type { Project, Flow, InfraIndex } from "@flowmap/shared";

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [infra, setInfra] = useState<InfraIndex | null>(null);
  const [scanning, setScanning] = useState(false);
  const [building, setBuilding] = useState(false);
  const [buildRequest, setBuildRequest] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    api.getProject(projectId).then(setProject).catch(console.error);
    api.listFlows(projectId).then(setFlows).catch(console.error);
    api.getInfra(projectId).then(setInfra).catch(() => null);
  }, [projectId]);

  async function handleScanInfra() {
    if (!projectId) return;
    setScanning(true);
    setError(null);
    try {
      const result = await api.scanInfra(projectId);
      setInfra(result);
      setProject((p) => p ? { ...p, infra_scanned: true } : p);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  }

  async function handleBuildFlows() {
    if (!projectId) return;
    setBuilding(true);
    setError(null);
    try {
      const newFlows = await api.buildFlows(projectId, buildRequest || undefined);
      setFlows((prev) => [...newFlows, ...prev]);
      setBuildRequest("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBuilding(false);
    }
  }

  if (!project) return <div style={styles.loading}>Loading…</div>;

  return (
    <div style={styles.page}>
      <div style={styles.breadcrumb}>
        <Link to="/projects" style={styles.link}>Projects</Link>
        <span style={styles.sep}>/</span>
        <span>{project.name}</span>
      </div>

      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>{project.name}</h1>
          <p style={styles.path}>{project.repo_path}</p>
        </div>
      </div>

      {error && <p style={styles.error}>{error}</p>}

      {/* Infra scan */}
      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Infrastructure Index</h2>
          <button style={styles.btn} onClick={handleScanInfra} disabled={scanning}>
            {scanning ? "Scanning…" : project.infra_scanned ? "Re-scan" : "Scan infra"}
          </button>
        </div>
        {infra ? (
          <div style={styles.infraGrid}>
            <InfraStat label="Queues" items={infra.queues.map((q) => q.name)} />
            <InfraStat label="Topics" items={infra.topics.map((t) => t.name)} />
            <InfraStat label="Workers" items={infra.workers.map((w) => w.function)} />
            <InfraStat label="Tables" items={infra.tables.map((t) => t.name)} />
          </div>
        ) : (
          <p style={styles.muted}>No infra scan yet. Click "Scan infra" to begin.</p>
        )}
      </section>

      {/* Flow builder */}
      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Flows</h2>
          <div style={styles.buildRow}>
            <input
              style={styles.input}
              placeholder="Describe a flow (optional — leave empty for auto-scan)"
              value={buildRequest}
              onChange={(e) => setBuildRequest(e.target.value)}
              disabled={!project.infra_scanned}
            />
            <button
              style={styles.btn}
              onClick={handleBuildFlows}
              disabled={building || !project.infra_scanned}
            >
              {building ? "Building…" : "Build flows"}
            </button>
          </div>
          {!project.infra_scanned && (
            <p style={styles.muted}>Run infra scan first before building flows.</p>
          )}
        </div>

        {flows.length === 0 ? (
          <p style={styles.muted}>No flows yet.</p>
        ) : (
          <div style={styles.flowList}>
            {flows.map((f) => (
              <button
                key={f.id}
                style={styles.flowCard}
                onClick={() => navigate(`/projects/${projectId}/flows/${f.id}`)}
              >
                <div style={styles.flowName}>{f.name}</div>
                <div style={styles.flowMeta}>
                  <TriggerBadge trigger={f.trigger} />
                  <span style={styles.confidence}>
                    {Math.round(f.meta.confidence * 100)}% confidence
                  </span>
                  <span style={styles.source}>{f.meta.source === "auto_scan" ? "auto" : "user"}</span>
                </div>
                {f.description && <p style={styles.flowDesc}>{f.description}</p>}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function InfraStat({ label, items }: { label: string; items: string[] }) {
  return (
    <div style={styles.infraCard}>
      <div style={styles.infraLabel}>{label} ({items.length})</div>
      {items.slice(0, 5).map((item) => (
        <div key={item} style={styles.infraItem}>{item}</div>
      ))}
      {items.length > 5 && <div style={styles.muted}>+{items.length - 5} more</div>}
    </div>
  );
}

function TriggerBadge({ trigger }: { trigger: Flow["trigger"] }) {
  const label =
    trigger.type === "queue" ? `queue: ${trigger.queue_name}` :
    trigger.type === "webhook" ? `${trigger.method} ${trigger.path}` :
    trigger.type;
  return <span style={styles.triggerBadge}>{label}</span>;
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", padding: "36px 24px", maxWidth: 900, margin: "0 auto" },
  loading: { padding: 48, color: "#666" },
  breadcrumb: { display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#666", marginBottom: 24 },
  link: { color: "#888", textDecoration: "none" },
  sep: { color: "#444" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 36 },
  title: { fontSize: 26, fontWeight: 700, letterSpacing: -0.5 },
  path: { color: "#666", fontSize: 13, marginTop: 4 },
  error: { color: "#f87171", fontSize: 13, marginBottom: 16 },
  section: { marginBottom: 40 },
  sectionHeader: { display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: 600, flex: 1 },
  btn: { background: "#fff", color: "#000", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 600, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" },
  buildRow: { display: "flex", gap: 8, flex: 2 },
  input: { background: "#111", border: "1px solid #333", borderRadius: 8, padding: "8px 14px", color: "#e5e5e5", fontSize: 13, outline: "none", flex: 1 },
  muted: { color: "#555", fontSize: 13 },
  infraGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 },
  infraCard: { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: 16 },
  infraLabel: { fontWeight: 600, fontSize: 13, marginBottom: 8, color: "#aaa" },
  infraItem: { fontSize: 12, color: "#e5e5e5", padding: "2px 0", fontFamily: "monospace" },
  flowList: { display: "flex", flexDirection: "column", gap: 8 },
  flowCard: { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: "16px 20px", cursor: "pointer", textAlign: "left", color: "inherit", width: "100%" },
  flowName: { fontWeight: 600, fontSize: 15 },
  flowMeta: { display: "flex", gap: 8, alignItems: "center", marginTop: 6 },
  flowDesc: { color: "#888", fontSize: 13, marginTop: 6 },
  triggerBadge: { background: "#1d2d44", color: "#60a5fa", fontSize: 11, padding: "2px 8px", borderRadius: 4, fontFamily: "monospace" },
  confidence: { color: "#666", fontSize: 12 },
  source: { color: "#555", fontSize: 11, background: "#222", padding: "2px 6px", borderRadius: 3 },
};
