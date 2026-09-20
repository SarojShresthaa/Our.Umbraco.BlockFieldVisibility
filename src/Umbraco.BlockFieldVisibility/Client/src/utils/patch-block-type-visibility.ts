import type { UmbBlockTypeWithFieldVisibility } from "../types.js";

export function patchBlockTypeVisibility(
  blocks: UmbBlockTypeWithFieldVisibility[],
  contentElementTypeKey: string,
  target: "content" | "settings",
  alias: string,
  hide: boolean,
): UmbBlockTypeWithFieldVisibility[] {
  return blocks.map((block) => {
    if (block.contentElementTypeKey !== contentElementTypeKey) {
      return block;
    }
    if (target === "content") {
      return {
        ...block,
        fieldVisibility: { ...(block.fieldVisibility ?? {}), [alias]: hide },
      };
    }
    return {
      ...block,
      settingsFieldVisibility: { ...(block.settingsFieldVisibility ?? {}), [alias]: hide },
    };
  });
}
