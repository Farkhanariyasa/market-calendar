import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: "Discord Calendar Dashboard",
  description: "Manage your Discord bot calendar events.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-900 text-white min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
