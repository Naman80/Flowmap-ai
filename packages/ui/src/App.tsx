import { Routes, Route, Navigate } from "react-router-dom";
import ProjectsPage from "./pages/ProjectsPage.tsx";
import ProjectPage from "./pages/ProjectPage.tsx";
import FlowPage from "./pages/FlowPage.tsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/projects" replace />} />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/projects/:projectId" element={<ProjectPage />} />
      <Route path="/projects/:projectId/flows/:flowId" element={<FlowPage />} />
    </Routes>
  );
}
