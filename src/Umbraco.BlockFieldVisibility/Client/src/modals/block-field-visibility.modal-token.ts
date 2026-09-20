import { UmbModalToken } from "@umbraco-cms/backoffice/modal";

export interface UmbBlockFieldVisibilityModalData {
  dataTypeUnique: string;
  headline?: string;
}

export type UmbBlockFieldVisibilityModalValue = boolean;

export const UMB_BLOCK_FIELD_VISIBILITY_MODAL = new UmbModalToken<
  UmbBlockFieldVisibilityModalData,
  UmbBlockFieldVisibilityModalValue
>("Umbraco.BlockFieldVisibility.Modal", {
  modal: {
    type: "sidebar",
    size: "large",
  },
});
