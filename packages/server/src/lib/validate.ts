import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

/**
 * Returns an Express middleware that validates req.body against a Zod schema.
 * Responds 400 with a clear error message on failure.
 */
export function validate<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues
        .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
        .join("; ");
      res.status(400).json({ ok: false, error: message });
      return;
    }
    req.body = result.data;
    next();
  };
}

// ─── Shared schemas ───────────────────────────────────────────────────────────

export const ProjectCreateSchema = z.object({
  name: z.string().min(1).optional(),
  repo_path: z.string().min(1, "repo_path is required"),
});

export const ProjectPatchSchema = z.object({
  name: z.string().min(1).optional(),
  app_url: z.string().url("app_url must be a valid URL").optional().or(z.literal("")),
  redis_url: z.string().min(1).optional().or(z.literal("")),
});

export const FlowBuildSchema = z.object({
  project_id: z.string().uuid("project_id must be a valid UUID"),
  request: z.string().min(1).optional(),
});

export const FlowGraphBuildSchema = z.object({
  project_id: z.string().uuid("project_id must be a valid UUID"),
});

export const EdgeObserveSchema = z.object({
  observed: z.boolean().optional(),
});

export const RunCreateSchema = z.object({
  flow_id: z.string().uuid("flow_id must be a valid UUID"),
  trigger_mode: z.enum(["ai", "manual"]).optional().default("manual"),
  input: z.unknown().optional(),
});

export const RunCompleteSchema = z.object({
  status: z.enum(["completed", "failed"]).optional().default("completed"),
  error: z.string().optional(),
});
