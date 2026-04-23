import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start";
import { getRouter } from "./router";

// Create the router instance using our factory
const router = getRouter();

// The StartClient component handles the actual hydration of the route tree
// using the framework's internal provider logic.
// @ts-ignore
hydrateRoot(document, <StartClient router={router} />);
