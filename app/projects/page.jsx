import ProjectsPage from "../../components/projects/ProjectsPage.jsx";

export const metadata = {
  title: "Мої проєкти",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LocalProjectsPage() {
  return <ProjectsPage />;
}
