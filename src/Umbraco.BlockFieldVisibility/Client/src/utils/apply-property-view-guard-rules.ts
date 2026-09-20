import type { UmbBlockFieldVisibilityMap } from "../types.js";

const VIEW_RULE_PREFIX = "Umbraco.BlockFieldVisibility.Hide.View.";

type PropertyGuardManager = {
  getRules(): Array<{ unique: unknown; permitted?: boolean }>;
  removeRules(uniques: unknown[]): void;
  addRule(rule: {
    unique: string;
    permitted: boolean;
    propertyType: { unique: string };
  }): void;
};

type PropertyViewGuardHost = {
  propertyViewGuard: PropertyGuardManager;
  structure: {
    getContentTypeProperties(): Promise<Array<{ alias: string; unique: string }>>;
    whenLoaded(): Promise<boolean>;
  };
};

function safeRemoveOurRules(guard: PropertyGuardManager, prefix: string) {
  try {
    const ours = guard
      .getRules()
      .filter((rule) => String(rule.unique).startsWith(prefix))
      .map((rule) => rule.unique);

    if (ours.length) {
      guard.removeRules(ours);
    }
  } catch {
    // Guard can be destroyed while a document workspace is loading/unloading.
  }
}

function safeAddDenyRules(
  guard: PropertyGuardManager,
  prefix: string,
  properties: Array<{ alias: string; unique: string }>,
  visibility: UmbBlockFieldVisibilityMap,
) {
  for (const [alias, hide] of Object.entries(visibility)) {
    if (hide !== true) {
      continue;
    }

    const property = properties.find((entry) => entry.alias === alias);
    if (!property?.unique) {
      continue;
    }

    try {
      guard.addRule({
        unique: `${prefix}${property.unique}`,
        permitted: false,
        propertyType: {
          unique: property.unique,
        },
      });
    } catch {
      return;
    }
  }
}

/** Block element editor: reset guard and apply hide map. */
export async function applyPropertyViewGuardRules(
  host: PropertyViewGuardHost,
  visibility: UmbBlockFieldVisibilityMap | undefined,
): Promise<void> {
  try {
    host.propertyViewGuard.clearRules();
    host.propertyViewGuard.fallbackToPermitted();
  } catch {
    return;
  }
  await syncDocumentHideRules(host, visibility);
}

/** Document workspace: add deny rules only (keeps user property permissions intact). */
export async function syncDocumentHideRules(
  host: PropertyViewGuardHost,
  visibility: UmbBlockFieldVisibilityMap | undefined,
): Promise<void> {
  try {
    await host.structure.whenLoaded();
  } catch {
    return;
  }

  safeRemoveOurRules(host.propertyViewGuard, VIEW_RULE_PREFIX);

  if (!visibility || !Object.values(visibility).some((hide) => hide === true)) {
    return;
  }

  let properties: Array<{ alias: string; unique: string }>;
  try {
    properties = await host.structure.getContentTypeProperties();
  } catch {
    return;
  }

  if (!properties.length) {
    return;
  }

  safeAddDenyRules(host.propertyViewGuard, VIEW_RULE_PREFIX, properties, visibility);
}
