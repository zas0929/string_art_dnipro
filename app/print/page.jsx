import PrintInstruction from "../../components/print/PrintInstruction.jsx";

export const metadata = {
  title: "Інструкція для друку",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PrintPage() {
  return <PrintInstruction />;
}
