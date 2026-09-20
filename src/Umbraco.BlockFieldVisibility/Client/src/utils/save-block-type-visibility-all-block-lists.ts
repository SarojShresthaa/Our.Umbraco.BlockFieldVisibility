import type { UmbControllerHost } from "@umbraco-cms/backoffice/controller-api";
import { UmbDataTypeDetailRepository } from "@umbraco-cms/backoffice/data-type";
import type { UmbBlockFieldVisibilityMap, UmbBlockTypeWithFieldVisibility } from "../types.js";
import { loadAllBlockListDataTypeOptions } from "./load-all-block-list-data-type-options.js";
import { getBlocksFromDataType, setBlocksOnDataType } from "./data-type-block-visibility.js";
import {
  notifyBlockElementTypeVisibilityUpdated,
  notifyBlockFieldVisibilityDataTypeUpdated,
} from "./block-field-visibility-data-type-events.js";

export async function saveBlockTypeVisibilityAcrossAllBlockLists(
  host: UmbControllerHost,
  contentElementTypeKey: string,
  fieldVisibility: UmbBlockFieldVisibilityMap,
  settingsFieldVisibility: UmbBlockFieldVisibilityMap,
  blockListDataTypeUnique?: string,
): Promise<{ saved: number; failed: number }> {
  const dataTypeRepository = new UmbDataTypeDetailRepository(host);
  const blockListDataTypes = await loadAllBlockListDataTypeOptions(host);

  let saved = 0;
  let failed = 0;

  for (const option of blockListDataTypes) {
    if (blockListDataTypeUnique && option.unique !== blockListDataTypeUnique) {
      continue;
    }
    const { data } = await dataTypeRepository.requestByUnique(option.unique);
    if (!data) {
      failed += 1;
      continue;
    }

    const blocks = getBlocksFromDataType(data);
    if (!blocks.some((block) => block.contentElementTypeKey === contentElementTypeKey)) {
      continue;
    }

    const nextBlocks: UmbBlockTypeWithFieldVisibility[] = blocks.map((block) => {
      if (block.contentElementTypeKey !== contentElementTypeKey) {
        return block;
      }
      return {
        ...block,
        fieldVisibility: { ...fieldVisibility },
        settingsFieldVisibility: { ...settingsFieldVisibility },
      };
    });

    const toSave = setBlocksOnDataType(data, nextBlocks);
    const { error } = await dataTypeRepository.save(toSave);
    if (error) {
      failed += 1;
    } else {
      saved += 1;
      notifyBlockFieldVisibilityDataTypeUpdated(option.unique, nextBlocks);
    }
  }

  notifyBlockElementTypeVisibilityUpdated(contentElementTypeKey, fieldVisibility, settingsFieldVisibility);
  return { saved, failed };
}
