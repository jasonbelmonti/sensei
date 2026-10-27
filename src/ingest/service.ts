import { resolve } from "node:path";
import type {
  DiscoveryEventType,
  DiscoveryPhase,
  DiscoveryRootConfig,
  SessionIngestService,
  SessionIngestServiceOptions,
} from "./contracts.js";
import {
  discoverFiles,
  type FileState,
  sameFileState,
} from "./files/discovery.js";
import { processFile } from "./files/process-file.js";

/** Serializes explicit scans, reconciliation, timer ticks and shutdown over fixed local readers. */
export function createSessionIngestService(
  options: SessionIngestServiceOptions,
): SessionIngestService {
  return new LocalIngestService(options);
}

class LocalIngestService implements SessionIngestService {
  readonly roots: DiscoveryRootConfig[];
  private readonly duplicates: DiscoveryRootConfig[] = [];
  private readonly snapshots = new Map<string, Map<string, FileState>>();
  private queue: Promise<unknown> = Promise.resolve();
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private started = false;
  private tickPending = false;
  private generation = 0;

  constructor(private readonly options: SessionIngestServiceOptions) {
    const roots = new Map<string, DiscoveryRootConfig>();
    for (const root of options.roots) {
      const normalized = { ...root, path: resolve(root.path) };
      const key = rootKey(normalized);
      if (roots.has(key)) this.duplicates.push(normalized);
      else roots.set(key, normalized);
    }
    this.roots = [...roots.values()];
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    const generation = ++this.generation;
    return this.enqueue(async () => {
      try {
        await this.scan("initial_scan", false, this.roots);
        if (!this.running || generation !== this.generation) return;
        this.started = true;
        for (const root of this.watchedRoots())
          await this.emit(root, "watch.started", "watch");
        this.timer = setInterval(
          () => this.tick(),
          this.options.watchIntervalMs ?? 250,
        );
      } catch (error) {
        this.running = false;
        this.clearTimer();
        throw error;
      }
    });
  }

  async stop(): Promise<void> {
    this.running = false;
    this.generation += 1;
    this.clearTimer();
    await this.enqueue(() => this.emitStopped());
  }

  scanNow(): Promise<void> {
    return this.enqueue(() => this.scan("initial_scan", false, this.roots));
  }

  reconcileNow(): Promise<void> {
    return this.enqueue(() => this.scan("reconcile", true, this.roots));
  }

  private enqueue(action: () => Promise<void>): Promise<void> {
    const result = this.queue.then(action);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private tick(): void {
    if (!this.running || this.tickPending) return;
    this.tickPending = true;
    void this.enqueue(async () => {
      if (!this.running) return;
      try {
        await this.scan("watch", true, this.watchedRoots());
      } catch (cause) {
        this.running = false;
        this.clearTimer();
        for (const root of this.watchedRoots()) {
          await this.options.onWarning?.({
            code: "watch-failed",
            message: "Watch processing failed; restart required",
            provider: root.provider,
            cause,
          });
        }
        await this.emitStopped();
      }
    })
      .catch(() => {
        this.running = false;
        this.clearTimer();
      })
      .finally(() => {
        this.tickPending = false;
      });
  }

  private async scan(
    phase: DiscoveryPhase,
    changesOnly: boolean,
    roots: DiscoveryRootConfig[],
  ) {
    for (const root of this.duplicates.splice(0)) {
      await this.options.onWarning?.({
        code: "duplicate-root",
        message: "Duplicate provider root skipped",
        provider: root.provider,
      });
    }
    for (const root of roots) {
      await this.emit(
        root,
        changesOnly ? "reconcile.started" : "scan.started",
        phase,
      );
      let current: Map<string, FileState>;
      try {
        current = await discoverFiles(root);
      } catch {
        await this.emit(
          root,
          "root.skipped",
          phase,
          undefined,
          "Root is not readable",
        );
        continue;
      }
      const previous = this.snapshots.get(rootKey(root));
      for (const [filePath, state] of current) {
        const old = previous?.get(filePath);
        if (changesOnly && old && sameFileState(old, state)) continue;
        for (const reader of this.options.registries) {
          if (reader.provider !== root.provider) continue;
          const match = reader.matchFile(filePath, root);
          if (!match) continue;
          await processFile({
            root,
            filePath,
            reader,
            match,
            phase,
            changed: !!old,
            service: this.options,
          });
          break;
        }
      }
      if (previous) {
        for (const filePath of previous.keys()) {
          if (current.has(filePath)) continue;
          await this.options.cursorStore?.delete({
            provider: root.provider,
            rootPath: root.path,
            filePath,
          });
          await this.emit(root, "file.deleted", phase, filePath);
        }
      }
      // A failed consumer never publishes this snapshot, so a retry revisits the file.
      this.snapshots.set(rootKey(root), current);
      await this.emit(
        root,
        changesOnly ? "reconcile.completed" : "scan.completed",
        phase,
      );
    }
  }

  private watchedRoots() {
    return this.roots.filter((root) => root.watch);
  }
  private clearTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
  private async emitStopped() {
    if (!this.started) return;
    this.started = false;
    for (const root of this.watchedRoots())
      await this.emit(root, "watch.stopped", "watch");
  }
  private async emit(
    root: DiscoveryRootConfig,
    type: DiscoveryEventType,
    discoveryPhase: DiscoveryPhase,
    filePath?: string,
    detail?: string,
  ) {
    await this.options.onDiscoveryEvent?.({
      type,
      provider: root.provider,
      rootPath: root.path,
      discoveryPhase,
      filePath,
      detail,
    });
  }
}

function rootKey(root: DiscoveryRootConfig) {
  return JSON.stringify([root.provider, root.path]);
}
