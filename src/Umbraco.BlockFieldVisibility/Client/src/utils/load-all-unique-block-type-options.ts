import type { UmbControllerHost } from "@umbraco-cms/backoffice/controller-api";
import { UmbDataTypeDetailRepository } from "@umbraco-cms/backoffice/data-type";
import {
  UmbDocumentTypeDetailRepository,
  UmbDocumentTypeItemRepository,
  type UmbDocumentTypeItemModel,
} from "@umbraco-cms/backoffice/document-type";
import { loadAllBlockListDataTypeOptions } from "./load-all-block-list-data-type-options.js";
import { getBlocksFromDataType } from "./data-type-block-visibility.js";
import type { UmbBlockFieldVisibilityMap } from "../types.js";

const BLOCK_LIST_EDITOR_UI = "Umb.PropertyEditorUi.BlockList";

export type BlockTypePlacement = {
  blockListDataTypeUnique: string;
  blockListDataTypeName: string;
  parentContentElementTypeKey?: string;
  parentPropertyAlias?: string;
  label: string;
  fieldVisibility: UmbBlockFieldVisibilityMap;
  settingsFieldVisibility: UmbBlockFieldVisibilityMap;
};

export type UniqueBlockTypeOption = {
  contentElementTypeKey: string;
  name: string;
  settingsElementTypeKey?: string;
  fieldVisibility: UmbBlockFieldVisibilityMap;
  settingsFieldVisibility: UmbBlockFieldVisibilityMap;
  placements: BlockTypePlacement[];
};

function mergeVisibility(
  target: UmbBlockFieldVisibilityMap,
  source: UmbBlockFieldVisibilityMap | undefined,
) {
  if (!source) {
    return;
  }
  for (const [alias, hide] of Object.entries(source)) {
    if (hide === true) {
      target[alias] = true;
    }
  }
}

type NestedBlockListRef = {
  parentContentElementTypeKey: string;
  parentPropertyAlias: string;
  blockListDataTypeUnique: string;
};

const ELEMENT_TYPE_BATCH_SIZE = 20;

async function loadNestedBlockListRefs(
  host: UmbControllerHost,
  blockListDataTypeIds: Set<string>,
  elementTypeKeys: Set<string>,
): Promise<NestedBlockListRef[]> {
  const refs: NestedBlockListRef[] = [];
  const documentTypeRepository = new UmbDocumentTypeDetailRepository(host);
  const dataTypeRepository = new UmbDataTypeDetailRepository(host);
  const keys = [...elementTypeKeys];

  for (let index = 0; index < keys.length; index += ELEMENT_TYPE_BATCH_SIZE) {
    const batch = keys.slice(index, index + ELEMENT_TYPE_BATCH_SIZE);
    const { data: elementTypes } = await documentTypeRepository.requestByUniques(batch);

    for (const elementType of elementTypes ?? []) {
      if (!elementType.properties?.length) {
        continue;
      }

      for (const property of elementType.properties) {
        const dataTypeUnique = property.dataType?.unique;
        if (!dataTypeUnique || !blockListDataTypeIds.has(dataTypeUnique)) {
          continue;
        }

        const { data: dataType, error } = await dataTypeRepository.requestByUnique(dataTypeUnique);
        if (error || dataType?.editorUiAlias !== BLOCK_LIST_EDITOR_UI) {
          continue;
        }

        refs.push({
          parentContentElementTypeKey: elementType.unique,
          parentPropertyAlias: property.alias,
          blockListDataTypeUnique: dataTypeUnique,
        });
      }
    }
  }

  return refs;
}

export function getPlacementScopeValue(placement: BlockTypePlacement): string {
  return `${placement.blockListDataTypeUnique}|${placement.parentContentElementTypeKey ?? ""}|${placement.parentPropertyAlias ?? ""}`;
}

function placementKey(placement: BlockTypePlacement) {
  return getPlacementScopeValue(placement);
}

export function isNestedBlockListPlacement(placement: BlockTypePlacement): boolean {
  return !!placement.parentContentElementTypeKey;
}

export function getNestedPlacements(option: UniqueBlockTypeOption): BlockTypePlacement[] {
  return option.placements.filter(isNestedBlockListPlacement);
}

/** Data type id saved to the API (first segment of scope value). */
export function parseBlockListDataTypeFromScope(scope: string): string | undefined {
  if (!scope) {
    return undefined;
  }
  const id = scope.split("|")[0];
  return id || undefined;
}

export async function loadAllUniqueBlockTypeOptions(
  host: UmbControllerHost,
): Promise<UniqueBlockTypeOption[]> {
  const blockListDataTypes = await loadAllBlockListDataTypeOptions(host);
  const dataTypeRepository = new UmbDataTypeDetailRepository(host);
  const blockListNameById = new Map(blockListDataTypes.map((item) => [item.unique, item.name]));
  const blockListIds = new Set(blockListDataTypes.map((item) => item.unique));
  const byContentKey = new Map<string, UniqueBlockTypeOption>();
  const elementTypeKeys = new Set<string>();

  for (const dataTypeOption of blockListDataTypes) {
    const { data } = await dataTypeRepository.requestByUnique(dataTypeOption.unique);
    if (!data) {
      continue;
    }

    for (const block of getBlocksFromDataType(data)) {
      const key = block.contentElementTypeKey;
      if (!key) {
        continue;
      }

      elementTypeKeys.add(key);

      const placement: BlockTypePlacement = {
        blockListDataTypeUnique: dataTypeOption.unique,
        blockListDataTypeName: dataTypeOption.name,
        label: `Block list: ${dataTypeOption.name}`,
        fieldVisibility: { ...(block.fieldVisibility ?? {}) },
        settingsFieldVisibility: { ...(block.settingsFieldVisibility ?? {}) },
      };

      let option = byContentKey.get(key);
      if (!option) {
        option = {
          contentElementTypeKey: key,
          name: key,
          settingsElementTypeKey: block.settingsElementTypeKey,
          fieldVisibility: { ...(block.fieldVisibility ?? {}) },
          settingsFieldVisibility: { ...(block.settingsFieldVisibility ?? {}) },
          placements: [placement],
        };
        byContentKey.set(key, option);
        continue;
      }

      if (!option.settingsElementTypeKey && block.settingsElementTypeKey) {
        option.settingsElementTypeKey = block.settingsElementTypeKey;
      }

      mergeVisibility(option.fieldVisibility, block.fieldVisibility);
      mergeVisibility(option.settingsFieldVisibility, block.settingsFieldVisibility);

      const existingPlacement = option.placements.find((p) => placementKey(p) === placementKey(placement));
      if (existingPlacement) {
        mergeVisibility(existingPlacement.fieldVisibility, block.fieldVisibility);
        mergeVisibility(existingPlacement.settingsFieldVisibility, block.settingsFieldVisibility);
      } else {
        option.placements.push(placement);
      }
    }
  }

  const nestedRefs = await loadNestedBlockListRefs(host, blockListIds, elementTypeKeys);
  const itemRepository = new UmbDocumentTypeItemRepository(host);
  const parentKeys = [...new Set(nestedRefs.map((ref) => ref.parentContentElementTypeKey))];
  const { data: parentItems } = parentKeys.length
    ? await itemRepository.requestItems(parentKeys)
    : { data: [] as UmbDocumentTypeItemModel[] };
  const parentNameByKey = new Map((parentItems ?? []).map((item) => [item.unique, item.name]));

  for (const ref of nestedRefs) {
    const parentName = parentNameByKey.get(ref.parentContentElementTypeKey) ?? ref.parentContentElementTypeKey;
    const blockListName = blockListNameById.get(ref.blockListDataTypeUnique) ?? ref.blockListDataTypeUnique;

    for (const option of byContentKey.values()) {
      const rootPlacement = option.placements.find(
        (p) => p.blockListDataTypeUnique === ref.blockListDataTypeUnique && !p.parentContentElementTypeKey,
      );
      if (!rootPlacement) {
        continue;
      }

      const nestedPlacement: BlockTypePlacement = {
        blockListDataTypeUnique: ref.blockListDataTypeUnique,
        blockListDataTypeName: blockListName,
        parentContentElementTypeKey: ref.parentContentElementTypeKey,
        parentPropertyAlias: ref.parentPropertyAlias,
        label: `Nested block list: ${parentName} › ${ref.parentPropertyAlias} › ${blockListName}`,
        fieldVisibility: { ...rootPlacement.fieldVisibility },
        settingsFieldVisibility: { ...rootPlacement.settingsFieldVisibility },
      };

      if (option.placements.some((p) => placementKey(p) === placementKey(nestedPlacement))) {
        continue;
      }

      option.placements.push(nestedPlacement);
    }
  }

  const options = [...byContentKey.values()];
  if (!options.length) {
    return [];
  }

  const keys = options.flatMap((option) =>
    [option.contentElementTypeKey, option.settingsElementTypeKey].filter(Boolean),
  ) as string[];

  const { data: items } = await itemRepository.requestItems(keys);
  const nameByKey = new Map<string, string>();
  (items ?? []).forEach((item: UmbDocumentTypeItemModel) => nameByKey.set(item.unique, item.name));

  return options
    .map((option) => ({
      ...option,
      name: nameByKey.get(option.contentElementTypeKey) ?? option.contentElementTypeKey,
      placements: [...option.placements].sort((a, b) => a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getBlockVisibilityForScope(
  option: UniqueBlockTypeOption,
  blockListScope: string,
): { fieldVisibility: UmbBlockFieldVisibilityMap; settingsFieldVisibility: UmbBlockFieldVisibilityMap } {
  if (!blockListScope) {
    return {
      fieldVisibility: { ...option.fieldVisibility },
      settingsFieldVisibility: { ...option.settingsFieldVisibility },
    };
  }

  const placement =
    option.placements.find((p) => getPlacementScopeValue(p) === blockListScope) ??
    option.placements.find((p) => p.blockListDataTypeUnique === blockListScope);

  if (!placement) {
    return { fieldVisibility: {}, settingsFieldVisibility: {} };
  }

  return {
    fieldVisibility: { ...placement.fieldVisibility },
    settingsFieldVisibility: { ...placement.settingsFieldVisibility },
  };
}
