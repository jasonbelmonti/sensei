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

export * from "./config";
export * from "./ingest";
export * from "./storage";
