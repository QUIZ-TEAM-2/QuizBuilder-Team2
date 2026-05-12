import "@/styles/globals.css";
import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";
import { ConvexClientProvider } from "@/components/providers/convex-provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "VisionVerse",
  description: "Create, share, and explore personality quizzes.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body>
        <ConvexClientProvider>
          {/* Avoid nested <main> (pages render their own main); nested mains can confuse a11y tooling. */}
          <div className="min-h-dvh">{children}</div>
          <Toaster />
        </ConvexClientProvider>
      </body>
    </html>
  );
}
