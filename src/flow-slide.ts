import { z } from "zod";

export const NodeTypeSchema = z.enum(["client", "server", "database"]);
export type NodeType = z.infer<typeof NodeTypeSchema>;

export const FlowNodeSchema = z.object({
  id: z.string().min(1, "Node id cannot be empty"),
  label: z.string(),
  type: NodeTypeSchema,
});
export type FlowNode = z.infer<typeof FlowNodeSchema>;

export const FlowEdgeSchema = z.object({
  from: z.string().min(1, "Edge 'from' cannot be empty"),
  to: z.string().min(1, "Edge 'to' cannot be empty"),
  label: z.string().optional(),
});
export type FlowEdge = z.infer<typeof FlowEdgeSchema>;

export const FlowSlideSchema = z
  .object({
    template: z.literal("flow"),
    title: z.string(),
    nodes: z.array(FlowNodeSchema),
    edges: z.array(FlowEdgeSchema),
  })
  .superRefine((data, ctx) => {
    // 1. Node IDs must be unique
    const seenNodeIds = new Set<string>();
    data.nodes.forEach((node, index) => {
      if (seenNodeIds.has(node.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate node id: "${node.id}"`,
          path: ["nodes", index, "id"],
        });
      }
      seenNodeIds.add(node.id);
    });

    // 2. Every edge.from must reference an existing node
    // 3. Every edge.to must reference an existing node
    data.edges.forEach((edge, index) => {
      if (!seenNodeIds.has(edge.from)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `edge.from references non-existent node id: "${edge.from}"`,
          path: ["edges", index, "from"],
        });
      }
      if (!seenNodeIds.has(edge.to)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `edge.to references non-existent node id: "${edge.to}"`,
          path: ["edges", index, "to"],
        });
      }
    });
  });

export type FlowSlide = z.infer<typeof FlowSlideSchema>;
