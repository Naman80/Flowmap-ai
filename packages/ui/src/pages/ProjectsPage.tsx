import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.ts";
import type { Project } from "@flowmap/shared";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [repoPath, setRepoPath] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.listProjects().then(setProjects).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!repoPath.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const project = await api.createProject(name.trim() || repoPath.split("/").at(-1)!, repoPath.trim());
      navigate(`/projects/${project.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.logo}>FlowMap</h1>
        <p style={styles.tagline}>Make your backend flows visible</p>
      </div>

      <div style={styles.content}>
        <form onSubmit={handleCreate} style={styles.form}>
          <h2 style={styles.formTitle}>Connect a repository</h2>
          <input
            style={styles.input}
            placeholder="Repository path (absolute, e.g. /Users/you/myapp)"
            value={repoPath}
            onChange={(e) => setRepoPath(e.target.value)}
          />
          <input
            style={styles.input}
            placeholder="Project name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.btn} type="submit" disabled={creating || !repoPath.trim()}>
            {creating ? "Connecting…" : "Connect repo"}
          </button>
        </form>

        {loading ? (
          <p style={styles.muted}>Loading projects…</p>
        ) : projects.length === 0 ? (
          <p style={styles.muted}>No projects yet. Connect a repo above.</p>
        ) : (
          <div style={styles.projectList}>
            <h2 style={styles.sectionTitle}>Projects</h2>
            {projects.map((p) => (
              <button
                key={p.id}
                style={styles.projectCard}
                onClick={() => navigate(`/projects/${p.id}`)}
              >
                <div style={styles.projectName}>{p.name}</div>
                <div style={styles.projectMeta}>
                  {p.repo_path}
                  {p.infra_scanned && <span style={styles.badge}>infra scanned</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", padding: "48px 24px", maxWidth: 720, margin: "0 auto" },
  header: { marginBottom: 48 },
  logo: { fontSize: 32, fontWeight: 700, letterSpacing: -1 },
  tagline: { color: "#888", marginTop: 4 },
  content: { display: "flex", flexDirection: "column", gap: 40 },
  form: { display: "flex", flexDirection: "column", gap: 12, background: "#1a1a1a", padding: 24, borderRadius: 12 },
  formTitle: { fontSize: 16, fontWeight: 600, marginBottom: 4 },
  input: { background: "#111", border: "1px solid #333", borderRadius: 8, padding: "10px 14px", color: "#e5e5e5", fontSize: 14, outline: "none" },
  btn: { background: "#fff", color: "#000", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 600, cursor: "pointer", fontSize: 14 },
  error: { color: "#f87171", fontSize: 13 },
  muted: { color: "#666", fontSize: 14 },
  sectionTitle: { fontSize: 14, fontWeight: 600, color: "#888", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 },
  projectList: { display: "flex", flexDirection: "column", gap: 8 },
  projectCard: { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: "16px 20px", cursor: "pointer", textAlign: "left", color: "inherit", width: "100%" },
  projectName: { fontWeight: 600, fontSize: 15 },
  projectMeta: { color: "#666", fontSize: 12, marginTop: 4, display: "flex", gap: 8, alignItems: "center" },
  badge: { background: "#1d4ed8", color: "#fff", fontSize: 11, padding: "2px 8px", borderRadius: 4 },
};
