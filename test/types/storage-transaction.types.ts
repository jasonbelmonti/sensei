import type { SenseiStorage } from "../../src/storage";

declare const storage: SenseiStorage;

storage.transaction(({ conversations }) => {
  return conversations;
});

// @ts-expect-error Transaction callbacks must stay synchronous.
storage.transaction(async ({ conversations }) => {
  await Promise.resolve();
  return conversations;
});
