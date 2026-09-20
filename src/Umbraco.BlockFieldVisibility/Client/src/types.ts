/** Property alias → true when the field should be hidden in the block editor UI. */
export type UmbBlockFieldVisibilityMap = Record<string, boolean>;

export type UmbBlockTypeWithFieldVisibility = {
  contentElementTypeKey: string;
  settingsElementTypeKey?: string;
  fieldVisibility?: UmbBlockFieldVisibilityMap;
  settingsFieldVisibility?: UmbBlockFieldVisibilityMap;
};

export type UmbDocumentTypePropertyListItem = {
  alias: string;
  name: string;
};
