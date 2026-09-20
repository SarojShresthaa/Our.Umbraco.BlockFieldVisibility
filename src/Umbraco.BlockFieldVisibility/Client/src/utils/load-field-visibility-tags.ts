import type { UmbControllerHost } from "@umbraco-cms/backoffice/controller-api";
import type { UmbBlockFieldVisibilityMap } from "../types.js";
import { loadFieldVisibilityFromServer } from "./document-field-visibility-persistence.js";
import type { FieldVisibilityPageTypeOption } from "./load-field-visibility-page-type-options.js";
import {
  getPlacementScopeValue,
  isNestedBlockListPlacement,
  type UniqueBlockTypeOption,
} from "./load-all-unique-block-type-options.js";

export type FieldVisibilityTag = {
  kind: "page" | "block";
  id: string;
  label: string;
  hiddenCount: number;
  scopeValue?: string;
};

export function countHiddenFieldRules(map: UmbBlockFieldVisibilityMap | undefined): number {
  if (!map) {
    return 0;
  }
  return Object.values(map).filter((hide) => hide === true).length;
}

export function upsertPageFieldVisibilityTag(
  tags: FieldVisibilityTag[],
  pageTypes: FieldVisibilityPageTypeOption[],
  contentTypeUnique: string,
  fieldVisibility: UmbBlockFieldVisibilityMap,
): FieldVisibilityTag[] {
  const pageType = pageTypes.find((item) => item.unique === contentTypeUnique);
  if (!pageType) {
    return tags;
  }

  const hiddenCount = countHiddenFieldRules(fieldVisibility);
  const without = tags.filter((tag) => !(tag.kind === "page" && tag.id === contentTypeUnique));

  if (hiddenCount <= 0) {
    return without.sort((a, b) => a.label.localeCompare(b.label));
  }

  return [
    ...without,
    {
      kind: "page",
      id: contentTypeUnique,
      label: pageType.name,
      hiddenCount,
    },
  ].sort((a, b) => a.label.localeCompare(b.label));
}

export async function loadPageFieldVisibilityTags(
  host: UmbControllerHost,
  pageTypes: FieldVisibilityPageTypeOption[],
): Promise<FieldVisibilityTag[]> {
  const tags: FieldVisibilityTag[] = [];

  const pageResults = await Promise.all(
    pageTypes.map(async (pageType) => {
      const visibility = await loadFieldVisibilityFromServer(host, pageType.unique);
      const hiddenCount = countHiddenFieldRules(visibility);
      return hiddenCount > 0
        ? ({
            kind: "page" as const,
            id: pageType.unique,
            label: pageType.name,
            hiddenCount,
          } satisfies FieldVisibilityTag)
        : undefined;
    }),
  );

  tags.push(...pageResults.filter((tag): tag is FieldVisibilityTag => !!tag));
  return tags.sort((a, b) => a.label.localeCompare(b.label));
}

export function loadBlockFieldVisibilityTags(blockTypes: UniqueBlockTypeOption[]): FieldVisibilityTag[] {
  const tags: FieldVisibilityTag[] = [];

  for (const block of blockTypes) {
    let addedFromPlacements = false;

    for (const placement of block.placements) {
      const hiddenCount =
        countHiddenFieldRules(placement.fieldVisibility) +
        countHiddenFieldRules(placement.settingsFieldVisibility);
      if (hiddenCount <= 0) {
        continue;
      }

      addedFromPlacements = true;
      const contextLabel = isNestedBlockListPlacement(placement)
        ? placement.label.replace(/^Nested block list:\s*/i, "")
        : placement.blockListDataTypeName;

      tags.push({
        kind: "block",
        id: block.contentElementTypeKey,
        label: `${block.name} · ${contextLabel}`,
        hiddenCount,
        scopeValue: isNestedBlockListPlacement(placement)
          ? getPlacementScopeValue(placement)
          : undefined,
      });
    }

    if (addedFromPlacements) {
      continue;
    }

    const hiddenCount =
      countHiddenFieldRules(block.fieldVisibility) + countHiddenFieldRules(block.settingsFieldVisibility);
    if (hiddenCount > 0) {
      tags.push({
        kind: "block",
        id: block.contentElementTypeKey,
        label: block.name,
        hiddenCount,
      });
    }
  }

  return tags.sort((a, b) => a.label.localeCompare(b.label));
}
