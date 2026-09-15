import { FlowSlideSchema } from "./flow-slide.js";

console.log("=== 1. Testing Valid FlowSlide JSON ===");
const validSlide = {
  template: "flow",
  title: "Client-Server-Database Lifecycle",
  nodes: [
    { id: "client", label: "Browser Client", type: "client" },
    { id: "api", label: "API Gateway", type: "server" },
    { id: "db", label: "PostgreSQL Database", type: "database" },
  ],
  edges: [
    { from: "client", to: "api", label: "GET /profile" },
    { from: "api", to: "db", label: "SELECT * FROM users" },
  ],
};

const validResult = FlowSlideSchema.safeParse(validSlide);
console.log("Valid result success:", validResult.success);
if (validResult.success) {
  console.log("Parsed data:", JSON.stringify(validResult.data, null, 2));
}

console.log("\n=== 2. Testing Failure: Duplicate Node IDs ===");
const duplicateNodes = {
  template: "flow",
  title: "Duplicate Node Test",
  nodes: [
    { id: "server-1", label: "Web Server", type: "server" },
    { id: "server-1", label: "Web Server Duplicate", type: "server" },
  ],
  edges: [],
};
const duplicateResult = FlowSlideSchema.safeParse(duplicateNodes);
console.log("Duplicate result success:", duplicateResult.success);
if (!duplicateResult.success) {
  console.log("Issues:", duplicateResult.error.issues);
}

console.log("\n=== 3. Testing Failure: edge.from referencing non-existent node ===");
const invalidEdgeFrom = {
  template: "flow",
  title: "Invalid Edge From Test",
  nodes: [{ id: "server-1", label: "Web Server", type: "server" }],
  edges: [{ from: "ghost-node", to: "server-1" }],
};
const invalidEdgeFromResult = FlowSlideSchema.safeParse(invalidEdgeFrom);
console.log("Invalid edge.from success:", invalidEdgeFromResult.success);
if (!invalidEdgeFromResult.success) {
  console.log("Issues:", invalidEdgeFromResult.error.issues);
}

console.log("\n=== 4. Testing Failure: edge.to referencing non-existent node ===");
const invalidEdgeTo = {
  template: "flow",
  title: "Invalid Edge To Test",
  nodes: [{ id: "server-1", label: "Web Server", type: "server" }],
  edges: [{ from: "server-1", to: "ghost-node" }],
};
const invalidEdgeToResult = FlowSlideSchema.safeParse(invalidEdgeTo);
console.log("Invalid edge.to success:", invalidEdgeToResult.success);
if (!invalidEdgeToResult.success) {
  console.log("Issues:", invalidEdgeToResult.error.issues);
}

console.log("\n=== 5. Testing Failure: template is not 'flow' ===");
const invalidTemplate = {
  template: "card",
  title: "Invalid Template Test",
  nodes: [],
  edges: [],
};
const invalidTemplateResult = FlowSlideSchema.safeParse(invalidTemplate);
console.log("Invalid template success:", invalidTemplateResult.success);
if (!invalidTemplateResult.success) {
  console.log("Issues:", invalidTemplateResult.error.issues);
}

console.log("\n=== 6. Testing Failure: Invalid node type ===");
const invalidNodeType = {
  template: "flow",
  title: "Invalid Node Type Test",
  nodes: [{ id: "queue-1", label: "Message Queue", type: "queue" }],
  edges: [],
};
const invalidNodeTypeResult = FlowSlideSchema.safeParse(invalidNodeType);
console.log("Invalid node type success:", invalidNodeTypeResult.success);
if (!invalidNodeTypeResult.success) {
  console.log("Issues:", invalidNodeTypeResult.error.issues);
}
