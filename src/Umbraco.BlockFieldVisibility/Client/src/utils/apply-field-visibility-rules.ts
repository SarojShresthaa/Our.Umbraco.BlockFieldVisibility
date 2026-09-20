import type { UmbBlockFieldVisibilityMap } from "../types.js";

const RULE_PREFIX = "Umbraco.BlockFieldVisibility.Hide.";

type BlockElementManagerLike = {
  propertyViewGuard: {
    clearRules(): void;
    fallbackToPermitted(): void;
    addRule(rule: {
      unique: string;
      permitted: boolean;
      propertyType: { unique: string };
    }): void;
  };
  structure: {
    getPropertyStructureByAlias(alias: string): Promise<{ unique: string } | undefined>;
  };
};

export async function applyFieldVisibilityRules(
  manager: BlockElementManagerLike,
  visibility: UmbBlockFieldVisibilityMap | undefined,
): Promise<void> {
  manager.propertyViewGuard.clearRules();
  manager.propertyViewGuard.fallbackToPermitted();

  if (!visibility) {
    return;
  }

  for (const [alias, hide] of Object.entries(visibility)) {
    if (hide !== true) {
      continue;
    }

    const property = await manager.structure.getPropertyStructureByAlias(alias);
    if (!property) {
      continue;
    }

    manager.propertyViewGuard.addRule({
      unique: `${RULE_PREFIX}${property.unique}`,
      permitted: false,
      propertyType: {
        unique: property.unique,
      },
    });
  }
}
