import type { UmbDataTypeDetailModel } from "@umbraco-cms/backoffice/data-type";
import type { UmbBlockTypeWithFieldVisibility } from "../types.js";

export function getBlocksFromDataType(dataType: UmbDataTypeDetailModel | undefined): UmbBlockTypeWithFieldVisibility[] {
  const blocks = dataType?.values?.find((v) => v.alias === "blocks")?.value;
  return Array.isArray(blocks) ? (blocks as UmbBlockTypeWithFieldVisibility[]) : [];
}

export function setBlocksOnDataType(
  dataType: UmbDataTypeDetailModel,
  blocks: UmbBlockTypeWithFieldVisibility[],
): UmbDataTypeDetailModel {
  const values = [...(dataType.values ?? [])];
  const index = values.findIndex((v) => v.alias === "blocks");
  const entry = { alias: "blocks", value: blocks };
  if (index === -1) {
    values.push(entry);
  } else {
    values[index] = entry;
  }
  return { ...dataType, values };
}

export function updatePropertyConfigBlocks(
  config: Array<{ alias: string; value?: unknown }> | undefined,
  blocks: UmbBlockTypeWithFieldVisibility[],
) {
  const next = [...(config ?? [])];
  const index = next.findIndex((c) => c.alias === "blocks");
  const entry = { alias: "blocks", value: blocks };
  if (index === -1) {
    next.push(entry);
  } else {
    next[index] = entry;
  }
  return next;
}
