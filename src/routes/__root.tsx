import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { EmailGate } from "@/components/rukisha/EmailGate";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Compass — Project Tracker" },
      { name: "description", content: "Compass — track your project from kickoff to go-live." },
      { property: "og:title", content: "Compass — Project Tracker" },
      {
        property: "og:description",
        content: "Compass — track your project from kickoff to go-live.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      {
        rel: "manifest",
        href: "/manifest.webmanifest",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        type: "image/svg+xml",
        href: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="%231A3C5E" /><circle cx="16" cy="16" r="10" stroke="%23C9A227" stroke-width="2" fill="none" /><polygon points="20.24 11.76 18.12 18.12 11.76 20.24 13.88 13.88" fill="%23C9A227" /></svg>',
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Toaster
          closeButton
          position="top-right"
          expand={true}
          richColors
          toastOptions={{
            style: {
              background: "var(--rk-navy)",
              color: "white",
              border: "1px solid var(--border)",
            },
          }}
        />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <EmailGate>
      <Outlet />
    </EmailGate>
  );
}
