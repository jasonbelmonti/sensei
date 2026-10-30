export const repositoryAreas = [
  "analysis",
  "cli",
  "config",
  "drafting",
  "ingest",
  "reporting",
  "storage",
] as const;

export type RepositoryArea = (typeof repositoryAreas)[number];

export function getRepositoryAreas(): RepositoryArea[] {
  return [...repositoryAreas];
}

export * from "./analysis/index.js";
export * from "./config/index.js";
export * from "./ingest/index.js";
export * from "./storage/index.js";
