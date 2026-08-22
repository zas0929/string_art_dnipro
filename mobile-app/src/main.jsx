import { lazy, StrictMode, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import "../../app/globals.css";
import { AuthSessionProvider } from "../../components/auth/AuthSessionProvider.jsx";
import { LanguageProvider } from "../../components/i18n/LanguageProvider.jsx";
import NativeAppBridge from "../../components/mobile/NativeAppBridge.jsx";
import MobileNavigation from "../../components/navigation/MobileNavigation.jsx";

const StringArtGenerator = lazy(() => import("../../components/StringArtGenerator.jsx"));
const ProjectsPage = lazy(() => import("../../components/projects/ProjectsPage.jsx"));
const BuildMode = lazy(() => import("../../components/build/BuildMode.jsx"));
const SharedBuildMode = lazy(() => import("../../components/build/SharedBuildMode.jsx"));
const MobileAuthForm = lazy(() => import("../../components/auth/MobileAuthForm.jsx"));

const MOBILE_ROUTES = new Set(["/create", "/projects", "/build", "/login"]);

function normalizePathname(pathname) {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return normalized === "/" ? "/create" : normalized;
}

function readRoute() {
  const pathname = normalizePathname(window.location.pathname);
  const sharedMatch = pathname.match(/^\/s\/([^/]+)$/);
  if (sharedMatch) {
    return { pathname, page: "shared", token: decodeURIComponent(sharedMatch[1]) };
  }
  if (MOBILE_ROUTES.has(pathname)) {
    return { pathname, page: pathname.slice(1), token: null };
  }
  return { pathname: "/create", page: "create", token: null };
}

function MobileRouteFallback() {
  return (
    <main className="build-loading" role="status" aria-live="polite">
      <span>String Art Dnipro</span>
    </main>
  );
}

function MobileApp() {
  const [route, setRoute] = useState(readRoute);

  useEffect(() => {
    const syncRoute = () => setRoute(readRoute());
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);

  useEffect(() => {
    if (route.pathname !== window.location.pathname) {
      window.history.replaceState(null, "", route.pathname);
    }
    document.title = route.page === "build" || route.page === "shared"
      ? "Build mode · String Art Dnipro"
      : route.page === "projects"
        ? "Projects · String Art Dnipro"
        : "String Art Generator";
  }, [route]);

  let content = <StringArtGenerator />;
  if (route.page === "projects") content = <ProjectsPage />;
  if (route.page === "build") content = <BuildMode />;
  if (route.page === "login") content = <MobileAuthForm />;
  if (route.page === "shared") content = <SharedBuildMode token={route.token} />;

  return (
    <LanguageProvider>
      <AuthSessionProvider user={null}>
        <NativeAppBridge />
        <MobileNavigation />
        <Suspense fallback={<MobileRouteFallback />}>
          {content}
        </Suspense>
      </AuthSessionProvider>
    </LanguageProvider>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <MobileApp />
  </StrictMode>,
);
