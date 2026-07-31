import SharedBuildMode from "../../../components/build/SharedBuildMode.jsx";

export const metadata = {
  title: "Build your String Art · String Art Dnipro",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SharedPatternPage({ params }) {
  const { token } = await params;
  return <SharedBuildMode token={token} />;
}
