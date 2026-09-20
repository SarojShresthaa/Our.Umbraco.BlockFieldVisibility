import type { UmbBlockFieldVisibilityMap, UmbBlockTypeWithFieldVisibility } from "../types.js";

export const BLOCK_FIELD_VISIBILITY_DATA_TYPE_UPDATED = "umbraco-block-field-visibility-data-type-updated";
export const BLOCK_ELEMENT_TYPE_VISIBILITY_UPDATED = "umbraco-block-element-type-visibility-updated";

export type BlockFieldVisibilityDataTypeUpdatedDetail = {
  dataTypeUnique: string;
  blocks: UmbBlockTypeWithFieldVisibility[];
};

export type BlockElementTypeVisibilityUpdatedDetail = {
  contentElementTypeKey: string;
  fieldVisibility: UmbBlockFieldVisibilityMap;
  settingsFieldVisibility: UmbBlockFieldVisibilityMap;
};

export function notifyBlockFieldVisibilityDataTypeUpdated(
  dataTypeUnique: string,
  blocks: UmbBlockTypeWithFieldVisibility[],
) {
  window.dispatchEvent(
    new CustomEvent(BLOCK_FIELD_VISIBILITY_DATA_TYPE_UPDATED, {
      detail: { dataTypeUnique, blocks } satisfies BlockFieldVisibilityDataTypeUpdatedDetail,
    }),
  );
}

export function notifyBlockElementTypeVisibilityUpdated(
  contentElementTypeKey: string,
  fieldVisibility: UmbBlockFieldVisibilityMap,
  settingsFieldVisibility: UmbBlockFieldVisibilityMap,
) {
  window.dispatchEvent(
    new CustomEvent(BLOCK_ELEMENT_TYPE_VISIBILITY_UPDATED, {
      detail: {
        contentElementTypeKey,
        fieldVisibility,
        settingsFieldVisibility,
      } satisfies BlockElementTypeVisibilityUpdatedDetail,
    }),
  );
}