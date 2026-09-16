import dagre from "@dagrejs/dagre";
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
  path?: string;
  midX?: number;
  midY?: number;
}

export interface FlowLayoutResult {
  nodes: NodeLayout[];
  edges: EdgeLayout[];
  stageWidth: number;
  stageHeight: number;
  graphWidth: number;
  graphHeight: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Deterministically computes node and edge positions using a Dagre graph layout.
 * Automatically fits and scales the graph bounding box inside fixed stage bounds.
 */
export function computeFlowLayout(slide: FlowSlide): FlowLayoutResult {
  const nodeWidth = 260;
  const nodeHeight = 130;

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: "LR",
    nodesep: 60,
    ranksep: 110,
    marginx: 0,
    marginy: 0,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of slide.nodes) {
    g.setNode(node.id, {
      width: nodeWidth,
      height: nodeHeight,
      label: node.label,
      type: node.type,
    });
  }

  for (const edge of slide.edges) {
    g.setEdge(edge.from, edge.to);
  }

  dagre.layout(g);

  // 1. Calculate actual Dagre bounding box across all nodes
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const node of slide.nodes) {
    const dagreNode = g.node(node.id);
    const left = dagreNode.x - dagreNode.width / 2;
    const right = dagreNode.x + dagreNode.width / 2;
    const top = dagreNode.y - dagreNode.height / 2;
    const bottom = dagreNode.y + dagreNode.height / 2;
    if (left < minX) minX = left;
    if (right > maxX) maxX = right;
    if (top < minY) minY = top;
    if (bottom > maxY) maxY = bottom;
  }

  const graphInfo = g.graph();
  const graphWidth = Math.round(slide.nodes.length > 0 ? (graphInfo.width ?? (maxX - minX)) : 0);
  const graphHeight = Math.round(slide.nodes.length > 0 ? (graphInfo.height ?? (maxY - minY)) : 0);

  // 2. Stage boundaries (fixed to canvas width 1080 - 2 * 80px padding)
  const stageWidth = 920;
  const minStageHeight = 520;
  const maxStageHeight = 760;
  const stageHeight = Math.min(maxStageHeight, Math.max(minStageHeight, Math.round(graphHeight + 80)));

  // 3. Keep reasonable padding from stage edges
  const paddingX = 36;
  const paddingY = 36;
  const availableWidth = stageWidth - 2 * paddingX;
  const availableHeight = stageHeight - 2 * paddingY;

  // 4. Deterministic scale factor to fit graph within stage bounds
  const scaleX = graphWidth > 0 ? availableWidth / graphWidth : 1;
  const scaleY = graphHeight > 0 ? availableHeight / graphHeight : 1;
  const scale = graphWidth > 0 && graphHeight > 0
    ? Math.min(1, scaleX, scaleY)
    : 1;

  // 5. Centering offsets
  const scaledWidth = graphWidth * scale;
  const scaledHeight = graphHeight * scale;
  const offsetX = Math.round((stageWidth - scaledWidth) / 2);
  const offsetY = Math.round((stageHeight - scaledHeight) / 2);

  const nodeMap = new Map<string, NodeLayout>();
  const nodes: NodeLayout[] = slide.nodes.map((node) => {
    const dagreNode = g.node(node.id);
    const x = Math.round(dagreNode.x - dagreNode.width / 2);
    const y = Math.round(dagreNode.y - dagreNode.height / 2);
    const layout: NodeLayout = {
      id: node.id,
      label: node.label,
      type: node.type,
      x,
      y,
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

    const route = computeEdgePath(x1, y1, x2, y2, 8);

    return {
      from: edge.from,
      to: edge.to,
      label: edge.label,
      x1,
      y1,
      x2,
      y2,
      path: route.path,
      midX: route.midX,
      midY: route.midY,
    };
  });

  return {
    nodes,
    edges,
    stageWidth,
    stageHeight,
    graphWidth,
    graphHeight,
    scale,
    offsetX,
    offsetY,
  };
}

/**
 * Deterministically computes an SVG path and midpoint for an edge.
 * Uses a straight horizontal line for linear connections, and a smooth
 * cubic Bézier S-curve with horizontal tangents for branching/diagonal connections.
 */
export function computeEdgePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  targetOffset: number = 8
): { path: string; midX: number; midY: number; targetX: number; targetY: number } {
  const targetX = x2 - targetOffset;
  const targetY = y2;
  const dx = targetX - x1;
  const dy = targetY - y1;

  const midX = Math.round((x1 + targetX) / 2);
  const midY = Math.round((y1 + targetY) / 2);

  // Strictly horizontal: straight line
  if (Math.abs(dy) < 1) {
    return {
      path: `M ${x1} ${y1} L ${targetX} ${targetY}`,
      midX,
      midY,
      targetX,
      targetY,
    };
  }

  // Non-horizontal: cubic Bézier S-curve with horizontal tangents
  const cp1x = Math.round(x1 + dx * 0.5);
  const cp1y = y1;
  const cp2x = Math.round(targetX - dx * 0.5);
  const cp2y = targetY;

  return {
    path: `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${targetX} ${targetY}`,
    midX,
    midY,
    targetX,
    targetY,
  };
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
      const route = edge.path
        ? { path: edge.path, midX: edge.midX ?? Math.round((edge.x1 + edge.x2 - 8) / 2), midY: edge.midY ?? Math.round((edge.y1 + edge.y2) / 2) }
        : computeEdgePath(edge.x1, edge.y1, edge.x2, edge.y2, 8);

      const labelWidth = edge.label ? Math.max(90, Math.round(edge.label.length * 8.5 + 24)) : 0;
      const labelHalfWidth = labelWidth / 2;

      const labelElement = edge.label
        ? `
        <rect x="${route.midX - labelHalfWidth}" y="${route.midY - 24}" width="${labelWidth}" height="22" rx="4" fill="#0d0d13" stroke="#1c1c24" stroke-width="1" />
        <text x="${route.midX}" y="${route.midY - 9}" text-anchor="middle" fill="#8e8e93" font-size="12" font-family="'JetBrains Mono', monospace" font-weight="500">${escapeHtml(
            edge.label
          )}</text>`
        : "";

      return `
      <g class="flow-edge">
        <path d="${route.path}" fill="none" stroke="#097fe8" stroke-width="2" stroke-dasharray="4 4" marker-end="url(#arrowhead)" />
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

    .flow-viewport {
      position: absolute;
      left: ${layout.offsetX}px;
      top: ${layout.offsetY}px;
      width: ${layout.graphWidth}px;
      height: ${layout.graphHeight}px;
      transform: scale(${layout.scale});
      transform-origin: 0 0;
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
        <div class="flow-viewport">
          <svg class="flow-svg" viewBox="0 0 ${layout.graphWidth} ${layout.graphHeight}">
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
