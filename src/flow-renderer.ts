import { FlowSlideSchema, type FlowSlide } from "./flow-slide.js";

export interface NodeLayout {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EdgeLayout {
  from: string;
  to: string;
  label?: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface FlowLayoutResult {
  nodes: NodeLayout[];
  edges: EdgeLayout[];
  stageWidth: number;
  stageHeight: number;
}

/**
 * Deterministically computes node and edge positions using a simple left-to-right layout.
 * Does not pollute the domain model with visual coordinates.
 */
export function computeFlowLayout(slide: FlowSlide): FlowLayoutResult {
  const stageWidth = 920;
  const stageHeight = 460;
  const nodeWidth = 220;
  const nodeHeight = 110;

  const count = slide.nodes.length;
  const totalNodesWidth = count * nodeWidth;
  const gap = count > 1 ? (stageWidth - totalNodesWidth) / (count - 1) : 0;
  const centerY = stageHeight / 2;
  const topY = centerY - nodeHeight / 2;

  const nodeMap = new Map<string, NodeLayout>();
  const nodes: NodeLayout[] = slide.nodes.map((node, index) => {
    const x = Math.round(index * (nodeWidth + gap));
    const layout: NodeLayout = {
      id: node.id,
      label: node.label,
      type: node.type,
      x,
      y: topY,
      width: nodeWidth,
      height: nodeHeight,
    };
    nodeMap.set(node.id, layout);
    return layout;
  });

  const edges: EdgeLayout[] = slide.edges.map((edge) => {
    const fromNode = nodeMap.get(edge.from);
    const toNode = nodeMap.get(edge.to);

    if (!fromNode || !toNode) {
      throw new Error(`Edge references invalid node: ${edge.from} -> ${edge.to}`);
    }

    const x1 = fromNode.x + fromNode.width;
    const y1 = fromNode.y + fromNode.height / 2;
    const x2 = toNode.x;
    const y2 = toNode.y + toNode.height / 2;

    return {
      from: edge.from,
      to: edge.to,
      label: edge.label,
      x1,
      y1,
      x2,
      y2,
    };
  });

  return { nodes, edges, stageWidth, stageHeight };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Validates and renders a FlowSlide into a complete, standalone HTML document
 * ready for Puppeteer rendering.
 */
export function renderFlowSlideToHtml(input: unknown): string {
  // Validate input schema
  const slide = FlowSlideSchema.parse(input);
  const layout = computeFlowLayout(slide);

  // SVG edges
  const edgeSvgElements = layout.edges
    .map((edge) => {
      // Offset slightly for marker arrowhead
      const targetOffset = 8;
      const targetX = edge.x2 > edge.x1 ? edge.x2 - targetOffset : edge.x2 + targetOffset;

      const midX = (edge.x1 + targetX) / 2;
      const midY = (edge.y1 + edge.y2) / 2;

      const labelElement = edge.label
        ? `
        <rect x="${midX - 55}" y="${midY - 26}" width="110" height="22" rx="4" fill="#0d0d13" stroke="#1c1c24" stroke-width="1" />
        <text x="${midX}" y="${midY - 11}" text-anchor="middle" fill="#8e8e93" font-size="12" font-family="'JetBrains Mono', monospace" font-weight="500">${escapeHtml(
            edge.label
          )}</text>`
        : "";

      return `
      <g class="flow-edge">
        <line x1="${edge.x1}" y1="${edge.y1}" x2="${targetX}" y2="${edge.y2}" stroke="#097fe8" stroke-width="2" stroke-dasharray="4 4" marker-end="url(#arrowhead)" />
        ${labelElement}
      </g>`;
    })
    .join("\n");

  // HTML nodes
  const nodeHtmlElements = layout.nodes
    .map((node) => {
      const typeBadge = escapeHtml(node.type.toUpperCase());
      const label = escapeHtml(node.label);

      return `
      <div class="flow-node flow-node-${node.type}" style="left: ${node.x}px; top: ${node.y}px; width: ${node.width}px; height: ${node.height}px;">
        <div class="node-badge">${typeBadge}</div>
        <div class="node-label">${label}</div>
        <div class="node-indicator"></div>
      </div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(slide.title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --canvas-width: 1080px;
      --canvas-height: 1350px;
      --bg: #0b0b0f;
      --surface: #0d0d13;
      --surface-raised: #12121a;
      --blue: #097fe8;
      --text-primary: #ffffff;
      --text-secondary: #b8b8bf;
      --text-muted: #8e8e93;
      --text-dim: #6b7280;
      --border: #1c1c24;
      --border-strong: #2a2a32;
      --font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --font-mono: "JetBrains Mono", monospace;
    }

    *, *::before, *::after {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      background: var(--bg);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      font-family: var(--font-sans);
      color: var(--text-primary);
      -webkit-font-smoothing: antialiased;
    }

    .carousel-cover {
      position: relative;
      width: var(--canvas-width);
      height: var(--canvas-height);
      background: var(--bg);
      overflow: hidden;
      flex-shrink: 0;
    }

    .grid-overlay {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px);
      background-size: 32px 32px;
      pointer-events: none;
    }

    .cover-content {
      position: relative;
      z-index: 2;
      width: 100%;
      height: 100%;
      padding: 70px 80px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .brand {
      color: var(--text-primary);
      font-size: 24px;
      font-weight: 600;
      letter-spacing: -0.01em;
      text-transform: uppercase;
      opacity: 0.9;
    }

    .category-label {
      color: var(--text-dim);
      font-size: 15px;
      font-weight: 500;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 6px 14px;
      border: 1px solid rgba(107, 114, 128, 0.25);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.02);
    }

    .headline-block {
      margin-top: 40px;
    }

    .kicker {
      font-family: var(--font-mono);
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 0.12em;
      color: var(--blue);
      text-transform: uppercase;
      margin-bottom: 12px;
    }

    .headline {
      font-size: 56px;
      font-weight: 700;
      line-height: 1.15;
      color: var(--text-primary);
      max-width: 920px;
    }

    .flow-stage {
      position: relative;
      width: ${layout.stageWidth}px;
      height: ${layout.stageHeight}px;
      margin-top: auto;
      margin-bottom: auto;
      background: rgba(13, 13, 19, 0.5);
      border: 1px solid var(--border);
      border-radius: 16px;
      overflow: visible;
    }

    .flow-svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      overflow: visible;
      pointer-events: none;
      z-index: 1;
    }

    .flow-nodes-layer {
      position: absolute;
      inset: 0;
      z-index: 2;
    }

    .flow-node {
      position: absolute;
      background: var(--surface-raised);
      border: 1px solid var(--border-strong);
      border-radius: 12px;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      transition: border-color 0.2s ease;
    }

    .flow-node-client {
      border-top: 3px solid #38bdf8;
    }

    .flow-node-server {
      border-top: 3px solid #818cf8;
    }

    .flow-node-database {
      border-top: 3px solid #34d399;
    }

    .node-badge {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      margin-bottom: 8px;
    }

    .node-label {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .bottom-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid var(--border);
      padding-top: 24px;
      font-family: var(--font-mono);
      font-size: 14px;
      color: var(--text-dim);
    }
  </style>
</head>
<body>
  <main class="carousel-cover">
    <div class="grid-overlay"></div>
    <div class="cover-content">
      <header class="top-bar">
        <div class="brand">CAROUSEL ENGINE</div>
        <div class="category-label">FLOW ARCHITECTURE</div>
      </header>

      <section class="headline-block">
        <div class="kicker">DETERMINISTIC TEMPLATE · FLOW</div>
        <h1 class="headline">${escapeHtml(slide.title)}</h1>
      </section>

      <div class="flow-stage">
        <svg class="flow-svg" viewBox="0 0 ${layout.stageWidth} ${layout.stageHeight}">
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <polygon points="0 1, 7 4, 0 7" fill="#097fe8" />
            </marker>
          </defs>
          ${edgeSvgElements}
        </svg>
        <div class="flow-nodes-layer">
          ${nodeHtmlElements}
        </div>
      </div>

      <footer class="bottom-bar">
        <span>SLIDE TEMPLATE: FLOW</span>
        <span>1080 × 1350</span>
      </footer>
    </div>
  </main>
</body>
</html>`;
}
