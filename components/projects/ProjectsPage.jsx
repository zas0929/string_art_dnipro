"use client";

import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left.mjs";
import Hammer from "lucide-react/dist/esm/icons/hammer.mjs";
import Pencil from "lucide-react/dist/esm/icons/pencil.mjs";
import Plus from "lucide-react/dist/esm/icons/plus.mjs";
import Printer from "lucide-react/dist/esm/icons/printer.mjs";
import Trash2 from "lucide-react/dist/esm/icons/trash-2.mjs";
import { useEffect, useRef, useState } from "react";
import { LOCAL_PROJECT_LIMIT } from "../../storage/local-project-store.js";
import { getProjectStore } from "../../storage/project-store.js";
import LanguageSwitch from "../i18n/LanguageSwitch.jsx";
import { useLanguage } from "../i18n/LanguageProvider.jsx";

export default function ProjectsPage() {
  const { language, t } = useLanguage();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [draftName, setDraftName] = useState("");
  const [projectLimit, setProjectLimit] = useState(LOCAL_PROJECT_LIMIT);
  const projectStoreRef = useRef(null);

  useEffect(() => {
    let active = true;
    getProjectStore()
      .then(async (store) => {
        projectStoreRef.current = store;
        if (active && store.migrationError) setError(store.migrationError.message);
        const [items, account] = await Promise.all([
          store.listProjects(),
          store.getAccount(),
        ]);
        if (active) setProjectLimit(account.projectLimit);
        return items;
      })
      .then((items) => {
        if (active) setProjects(items);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const openProject = async (projectId, destination) => {
    setError("");
    try {
      await projectStoreRef.current.activateProject(projectId);
      window.location.assign(destination);
    } catch (openError) {
      setError(openError.message);
    }
  };

  const saveName = async (event, projectId) => {
    event.preventDefault();
    try {
      const updated = await projectStoreRef.current.renameProject(projectId, draftName);
      if (updated) {
        setProjects((items) => items.map((item) => (
          item.id === projectId
            ? { ...item, name: updated.name, updatedAt: updated.updatedAt }
            : item
        )));
      }
      setEditingId(null);
    } catch (renameError) {
      setError(renameError.message);
    }
  };

  const removeProject = async (project) => {
    if (!window.confirm(t("projects.deleteConfirm", { name: project.name }))) return;
    try {
      await projectStoreRef.current.deleteProject(project.id);
      setProjects((items) => items.filter((item) => item.id !== project.id));
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  return (
    <main className="projects-page">
      <LanguageSwitch />
      <header className="projects-header">
        <div>
          <a className="back-link" href="/create">
            <ArrowLeft aria-hidden="true" size={18} />
            {t("common.generator")}
          </a>
          <h1>{t("projects.title")}</h1>
          <p>{t("projects.subtitle")}</p>
        </div>
        <div className="projects-header-actions">
          <span className="project-limit">
            {projectLimit === null
              ? t("projects.unlimitedSlots", { count: projects.length })
              : t("projects.slots", { count: projects.length, limit: projectLimit })}
          </span>
          <a className="command-link project-create" href="/create">
            <Plus aria-hidden="true" size={18} />
            {t("projects.create")}
          </a>
        </div>
      </header>

      {loading ? (
        <div className="projects-empty">{t("common.loading")}</div>
      ) : projects.length === 0 ? (
        <section className="projects-empty">
          <h2>{t("projects.emptyTitle")}</h2>
          <p>{t("projects.emptyHint")}</p>
          <a className="command-link" href="/create">
            <Plus aria-hidden="true" size={18} />
            {t("projects.createFirst")}
          </a>
        </section>
      ) : (
        <section className="projects-grid" aria-label={t("projects.listAria")}>
          {projects.map((project) => (
            <article className="project-card" key={project.id}>
              <div className="project-preview">
                {project.artworkPreviewDataUrl ? (
                  <img src={project.artworkPreviewDataUrl} alt="" />
                ) : (
                  <Hammer aria-hidden="true" size={38} />
                )}
              </div>
              <div className="project-card-body">
                {editingId === project.id ? (
                  <form className="project-rename" onSubmit={(event) => saveName(event, project.id)}>
                    <input
                      value={draftName}
                      maxLength={80}
                      autoFocus
                      aria-label={t("projects.name")}
                      onChange={(event) => setDraftName(event.target.value)}
                    />
                    <button type="submit">{t("projects.save")}</button>
                  </form>
                ) : (
                  <div className="project-title-row">
                    <h2>{project.name || t("projects.untitled")}</h2>
                    <button
                      className="project-icon-button"
                      type="button"
                      title={t("projects.rename")}
                      aria-label={t("projects.rename")}
                      onClick={() => {
                        setEditingId(project.id);
                        setDraftName(project.name || t("projects.untitled"));
                      }}
                    >
                      <Pencil aria-hidden="true" size={16} />
                    </button>
                  </div>
                )}
                <p className="project-meta">
                  {t("projects.summary", {
                    pins: project.pointCount,
                    lines: project.lineCount,
                  })}
                </p>
                <p className="project-date">
                  {formatProjectDate(project.updatedAt || project.createdAt, language)}
                </p>
                <ProjectProgress project={project} t={t} />
                <div className="project-actions">
                  <button type="button" onClick={() => openProject(project.id, "/build")}>
                    <Hammer aria-hidden="true" size={17} />
                    {t("projects.build")}
                  </button>
                  <button type="button" onClick={() => openProject(project.id, "/print")}>
                    <Printer aria-hidden="true" size={17} />
                    {t("projects.print")}
                  </button>
                  <button
                    className="project-delete"
                    type="button"
                    title={t("projects.delete")}
                    aria-label={t("projects.delete")}
                    onClick={() => removeProject(project)}
                  >
                    <Trash2 aria-hidden="true" size={17} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {error && <p className="projects-error" role="alert">{error}</p>}
    </main>
  );
}

function ProjectProgress({ project, t }) {
  const total = Math.max(0, Number(project.lineCount) || 0);
  const completed = Math.max(
    0,
    Math.min(total, Number(project.buildProgress?.stepIndex) || 0),
  );
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const label = completed <= 0
    ? t("projects.notStarted")
    : completed >= total
      ? t("projects.completed")
      : t("projects.progressStep", { current: completed, total });

  return (
    <div
      className="project-progress"
      aria-label={t("projects.progressAria", { current: completed, total })}
    >
      <div className="project-progress-label">
        <span>{label}</span>
        <strong>{percent}%</strong>
      </div>
      <div className="project-progress-track" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function formatProjectDate(value, language) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(language === "uk" ? "uk-UA" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
