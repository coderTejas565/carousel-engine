import type { FlowSlide } from "./flow-slide.js";

export const sampleFlowSlide: FlowSlide = {
  template: "flow",
  title: "GET /profile Request & Query Pipeline",
  nodes: [
    {
      id: "browser",
      label: "Browser",
      type: "client",
    },
    {
      id: "express",
      label: "Express Server",
      type: "server",
    },
    {
      id: "postgres",
      label: "PostgreSQL",
      type: "database",
    },
  ],
  edges: [
    {
      from: "browser",
      to: "express",
      label: "GET /profile",
    },
    {
      from: "express",
      to: "postgres",
      label: "Query user",
    },
  ],
};
