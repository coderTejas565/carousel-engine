import type { FlowSlide } from "./flow-slide.js";

export const sampleFlowSlide: FlowSlide = {
  template: "flow",
  title: "Cache Aside Request Flow",
  nodes: [
    {
      id: "client",
      label: "Client",
      type: "client",
    },
    {
      id: "api",
      label: "API Server",
      type: "server",
    },
    {
      id: "redis",
      label: "Redis",
      type: "server",
    },
    {
      id: "service",
      label: "User Service",
      type: "server",
    },
    {
      id: "database",
      label: "PostgreSQL",
      type: "database",
    },
  ],
  edges: [
    {
      from: "client",
      to: "api",
      label: "GET /user",
    },
    {
      from: "api",
      to: "redis",
      label: "Check Cache",
    },
    {
      from: "api",
      to: "service",
      label: "Cache Miss",
    },
    {
      from: "service",
      to: "database",
      label: "SQL Query",
    },
  ],
};