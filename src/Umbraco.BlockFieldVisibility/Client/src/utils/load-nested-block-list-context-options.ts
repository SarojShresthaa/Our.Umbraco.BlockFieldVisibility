import type { UmbControllerHost } from "@umbraco-cms/backoffice/controller-api";
import { UmbDataTypeDetailRepository } from "@umbraco-cms/backoffice/data-type";
import {
  UmbDocumentTypeDetailRepository,
  UmbDocumentTypeItemRepository,
} from "@umbraco-cms/backoffice/document-type";
import { getBlocksFromDataType } from "./data-type-block-visibility.js";
import { getPlacementScopeValue, type BlockTypePlacement } from "./load-all-unique-block-type-options.js";

const BLOCK_LIST_EDITOR_UI = "Umb.PropertyEditorUi.BlockList";

export const NESTED_CONTEXT_SELF = "__self__";

export type NestedBlockListContextOption = {
  name: string;
  /** `__self__` or `${contentElementTypeKey}::${scopeValue}` */
  value: string;
};

const VALUE_SEP = "::";

function scopeForNestedList(
  blockListDataTypeUnique: string,
  parentContentElementTypeKey: string,
  parentPropertyAlias: string,
): string {
  const placement: BlockTypePlacement = {
    blockListDataTypeUnique,
    blockListDataTypeName: "",
    parentContentElementTypeKey,
    parentPropertyAlias,
    label: "",
    fieldVisibility: {},
    settingsFieldVisibility: {},
  };
  return getPlacementScopeValue(placement);
}

/**
 * When a parent block (e.g. Hero) has Block List properties, list child block types
 * configured in those lists so the dashboard can show them in a dropdown.
 */
export async function loadNestedBlockListContextOptions(
  host: UmbControllerHost,
  parentContentElementTypeKey: string,
  parentDisplayName: string,
): Promise<NestedBlockListContextOption[]> {
  const documentTypeRepository = new UmbDocumentTypeDetailRepository(host);
  const dataTypeRepository = new UmbDataTypeDetailRepository(host);
  const itemRepository = new UmbDocumentTypeItemRepository(host);

  const { data: parentType } = await documentTypeRepository.requestByUnique(parentContentElementTypeKey);
  if (!parentType?.properties?.length) {
    return [];
  }

  const options: NestedBlockListContextOption[] = [
    {
      name: `${parentDisplayName} (this block)`,
      value: NESTED_CONTEXT_SELF,
    },
  ];

  const childKeys: string[] = [];

  for (const property of parentType.properties) {
    const dataTypeUnique = property.dataType?.unique;
    if (!dataTypeUnique) {
      continue;
    }

    const { data: dataType, error } = await dataTypeRepository.requestByUnique(dataTypeUnique);
    if (error || dataType?.editorUiAlias !== BLOCK_LIST_EDITOR_UI) {
      continue;
    }

    const scope = scopeForNestedList(dataTypeUnique, parentContentElementTypeKey, property.alias);
    const blocks = getBlocksFromDataType(dataType);

    for (const block of blocks) {
      const key = block.contentElementTypeKey;
      if (!key) {
        continue;
      }
      childKeys.push(key);
      options.push({
        name: `${property.name || property.alias} › …`,
        value: `${key}${VALUE_SEP}${scope}`,
      });
    }
  }

  if (childKeys.length) {
    const { data: items } = await itemRepository.requestItems([...new Set(childKeys)]);
    const nameByKey = new Map((items ?? []).map((item) => [item.unique, item.name]));

    for (const option of options) {
      if (option.value === NESTED_CONTEXT_SELF) {
        continue;
      }
      const sep = option.value.indexOf(VALUE_SEP);
      const childKey = option.value.slice(0, sep);
      const scope = option.value.slice(sep + VALUE_SEP.length);
      const childName = nameByKey.get(childKey) ?? childKey;
      const prefix = option.name.split(" › ")[0];
      option.name = `${prefix} › ${childName}`;
      option.value = `${childKey}${VALUE_SEP}${scope}`;
    }
  }

  return options.length > 1 ? options : [];
}

export function parseNestedContextValue(value: string): {
  contentElementTypeKey?: string;
  blockListScope: string;
} {
  if (!value || value === NESTED_CONTEXT_SELF) {
    return { blockListScope: "" };
  }

  const separator = value.indexOf(VALUE_SEP);
  if (separator === -1) {
    return { blockListScope: value };
  }

  return {
    contentElementTypeKey: value.slice(0, separator),
    blockListScope: value.slice(separator + VALUE_SEP.length),
  };
}
