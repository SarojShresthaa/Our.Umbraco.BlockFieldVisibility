import { UmbPropertyActionBase } from "@umbraco-cms/backoffice/property-action";
import { UMB_PROPERTY_CONTEXT } from "@umbraco-cms/backoffice/property";
import { UMB_CONTENT_WORKSPACE_CONTEXT } from "@umbraco-cms/backoffice/content";
import { umbOpenModal } from "@umbraco-cms/backoffice/modal";
import { UMB_BLOCK_FIELD_VISIBILITY_MODAL } from "../modals/block-field-visibility.modal-token.js";
import {
  getBlocksFromDataType,
  updatePropertyConfigBlocks,
} from "../utils/data-type-block-visibility.js";
import { UmbDataTypeDetailRepository } from "@umbraco-cms/backoffice/data-type";

export class UmbBlockFieldVisibilityPropertyAction extends UmbPropertyActionBase {
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
        headline: `Field visibility — ${propertyLabel}`,
      },
    });

    const dataTypeRepository = new UmbDataTypeDetailRepository(this);
    const { data: dataType } = await dataTypeRepository.requestByUnique(dataTypeUnique);
    if (!dataType) {
      return;
    }

    const blocks = getBlocksFromDataType(dataType);
    propertyContext.setConfig(updatePropertyConfigBlocks(propertyContext.getConfig(), blocks));
  }
}

export { UmbBlockFieldVisibilityPropertyAction as api };
