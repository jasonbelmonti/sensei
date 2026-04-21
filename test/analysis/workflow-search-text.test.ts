import { expect, test } from "bun:test";

import { normalizeWorkflowSearchPromptText } from "../../src/analysis";

test("workflow search prompt normalization is locale-insensitive", () => {
  const originalToLocaleLowerCase = String.prototype.toLocaleLowerCase;

  Object.defineProperty(String.prototype, "toLocaleLowerCase", {
    configurable: true,
    writable: true,
    value() {
      throw new Error("workflow search normalization must not call toLocaleLowerCase");
    },
  });

  try {
    expect(normalizeWorkflowSearchPromptText("I İ BEL-806")).toBe("i i bel 806");
  } finally {
    Object.defineProperty(String.prototype, "toLocaleLowerCase", {
      configurable: true,
      writable: true,
      value: originalToLocaleLowerCase,
    });
  }
});
