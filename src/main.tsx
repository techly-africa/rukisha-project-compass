import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";

const router = getRouter();
const rootElement = document.getElementById("root")!;

const root = createRoot(rootElement);
root.render(<RouterProvider router={router} />);
