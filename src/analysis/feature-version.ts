export const CURRENT_TURN_FEATURE_VERSION = 1 as const;

export type TurnFeatureVersion = number;

export function resolveTurnFeatureVersion(
  version: TurnFeatureVersion = CURRENT_TURN_FEATURE_VERSION,
): TurnFeatureVersion {
  if (!Number.isInteger(version) || version < 1) {
    throw new Error(
      `Turn feature version must be a positive integer. Received: ${version}`,
    );
  }

  return version;
}
