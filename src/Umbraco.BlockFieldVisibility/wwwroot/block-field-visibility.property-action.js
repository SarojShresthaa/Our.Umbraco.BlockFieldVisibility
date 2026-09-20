// src/modals/block-field-visibility.modal-token.ts
import { UmbModalToken } from "@umbraco-cms/backoffice/modal";
var UMB_BLOCK_FIELD_VISIBILITY_MODAL = new UmbModalToken("Umbraco.BlockFieldVisibility.Modal", {
  modal: {
    type: "sidebar",
    size: "large"
  }
});

// src/utils/data-type-block-visibility.ts
function getBlocksFromDataType(dataType) {
  const blocks = dataType?.values?.find((v) => v.alias === "blocks")?.value;
  return Array.isArray(blocks) ? blocks : [];
}
function setBlocksOnDataType(dataType, blocks) {
  const values = [...dataType.values ?? []];
  const index = values.findIndex((v) => v.alias === "blocks");
  const entry = { alias: "blocks", value: blocks };
  if (index === -1) {
    values.push(entry);
  } else {
    values[index] = entry;
  }
  return { ...dataType, values };
}
function updatePropertyConfigBlocks(config, blocks) {
  const next = [...config ?? []];
  const index = next.findIndex((c) => c.alias === "blocks");
  const entry = { alias: "blocks", value: blocks };
  if (index === -1) {
    next.push(entry);
  } else {
    next[index] = entry;
  }
  return next;
}

// src/property-actions/block-field-visibility.property-action.ts
import { UmbPropertyActionBase } from "@umbraco-cms/backoffice/property-action";
import { UMB_PROPERTY_CONTEXT } from "@umbraco-cms/backoffice/property";
import { UMB_CONTENT_WORKSPACE_CONTEXT } from "@umbraco-cms/backoffice/content";
import { umbOpenModal } from "@umbraco-cms/backoffice/modal";
import { UmbDataTypeDetailRepository } from "@umbraco-cms/backoffice/data-type";
var UmbBlockFieldVisibilityPropertyAction = class extends UmbPropertyActionBase {
  async execute() {
    const propertyContext = await this.getContext(UMB_PROPERTY_CONTEXT);
    const contentWorkspace = await this.getContext(UMB_CONTENT_WORKSPACE_CONTEXT);
    if (!propertyContext || !contentWorkspace) {
      return;
    }
    const alias = propertyContext.getAlias();
    if (!alias) {
      return;
    }
    const propertyStructure = await contentWorkspace.structure.getPropertyStructureByAlias(alias);
    const dataTypeUnique = propertyStructure?.dataType.unique;
    if (!dataTypeUnique) {
      return;
    }
    const propertyLabel = propertyContext.getLabel() ?? alias;
    await umbOpenModal(this, UMB_BLOCK_FIELD_VISIBILITY_MODAL, {
      data: {
        dataTypeUnique,
        headline: `Field visibility \u2014 ${propertyLabel}`
      }
    });
    const dataTypeRepository = new UmbDataTypeDetailRepository(this);
    const { data: dataType } = await dataTypeRepository.requestByUnique(dataTypeUnique);
    if (!dataType) {
      return;
    }
    const blocks = getBlocksFromDataType(dataType);
    propertyContext.setConfig(updatePropertyConfigBlocks(propertyContext.getConfig(), blocks));
  }
};
export {
  UmbBlockFieldVisibilityPropertyAction,
  UmbBlockFieldVisibilityPropertyAction as api
};
