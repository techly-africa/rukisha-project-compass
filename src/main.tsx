import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";

// Unregister any stale service workers — leftover workbox SW caches
// OPTIONS preflight responses that block PATCH/DELETE requests.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) reg.unregister();
  });
}

const router = getRouter();
const rootElement = document.getElementById("root")!;

const root = createRoot(rootElement);
root.render(<RouterProvider router={router} />);
