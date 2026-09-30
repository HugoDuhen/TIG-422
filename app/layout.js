import "./globals.css";

export const metadata = {
  title: "Planning TIG 422",
  description: "Planning des TIG (section et compagnie) - 422",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
