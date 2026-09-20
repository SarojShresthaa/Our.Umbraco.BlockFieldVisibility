import type { UmbControllerHost } from "@umbraco-cms/backoffice/controller-api";
import { UmbContentTypeStructureManager } from "@umbraco-cms/backoffice/content-type";
import { UMB_DOCUMENT_TYPE_DETAIL_REPOSITORY_ALIAS } from "@umbraco-cms/backoffice/document-type";
import { UmbDataTypeDetailRepository } from "@umbraco-cms/backoffice/data-type";

const BLOCK_LIST_EDITOR_UI = "Umb.PropertyEditorUi.BlockList";

export type BlockListPropertyOnDocumentType = {
  alias: string;
  name: string;
  dataTypeUnique: string;
};

export async function findBlockListPropertiesOnDocumentType(
  host: UmbControllerHost,
  documentTypeUnique: string,
): Promise<BlockListPropertyOnDocumentType[]> {
  const structure = new UmbContentTypeStructureManager(host, UMB_DOCUMENT_TYPE_DETAIL_REPOSITORY_ALIAS);
  await structure.loadType(documentTypeUnique);

  const properties = await structure.getContentTypeProperties();
  const dataTypeRepository = new UmbDataTypeDetailRepository(host);
  const editorUiByDataType = new Map<string, string | undefined>();
  const result: BlockListPropertyOnDocumentType[] = [];

  for (const property of properties) {
    const dataTypeUnique = property.dataType?.unique;
    if (!dataTypeUnique) {
      continue;
    }

    let editorUiAlias = editorUiByDataType.get(dataTypeUnique);
    if (editorUiAlias === undefined) {
      const { data } = await dataTypeRepository.requestByUnique(dataTypeUnique);
      editorUiAlias = data?.editorUiAlias;
      editorUiByDataType.set(dataTypeUnique, editorUiAlias);
    }

    if (editorUiAlias !== BLOCK_LIST_EDITOR_UI) {
      continue;
    }

    result.push({
      alias: property.alias,
      name: property.name,
      dataTypeUnique,
    });
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
}
