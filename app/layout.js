import "./globals.css";

export const metadata = {
  title: "Planning TIG 422",
  description: "Planning des TIG (section et compagnie) - 422",
  appleWebApp: {
    title: "TIG 422",
    statusBarStyle: "default",
  },
};

export const viewport = {
  themeColor: "#1d4ed8",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
