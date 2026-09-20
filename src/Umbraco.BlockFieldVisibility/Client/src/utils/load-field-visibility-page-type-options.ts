import type { UmbControllerHost } from "@umbraco-cms/backoffice/controller-api";
import {
  DocumentTypeService,
  type DocumentTypeTreeItemResponseModel,
} from "@umbraco-cms/backoffice/external/backend-api";
import { tryExecute } from "@umbraco-cms/backoffice/resources";
import {
  UmbDocumentTypeItemRepository,
  UmbDocumentTypeStructureRepository,
} from "@umbraco-cms/backoffice/document-type";

export type FieldVisibilityPageTypeOption = {
  unique: string;
  name: string;
};

const TREE_PAGE_SIZE = 100;
const PARENT_CHUNK_SIZE = 12;

async function loadTreePage(
  host: UmbControllerHost,
  parentId: string | undefined,
  skip: number,
): Promise<{ items: DocumentTypeTreeItemResponseModel[]; total: number } | undefined> {
  if (parentId === undefined) {
    const { data } = await tryExecute(
      host,
      DocumentTypeService.getTreeDocumentTypeRoot({
        query: { skip, take: TREE_PAGE_SIZE, foldersOnly: false },
      }),
    );
    return data ? { items: data.items, total: data.total } : undefined;
  }

  const { data } = await tryExecute(
    host,
    DocumentTypeService.getTreeDocumentTypeChildren({
      query: { parentId, skip, take: TREE_PAGE_SIZE, foldersOnly: false },
    }),
  );
  return data ? { items: data.items, total: data.total } : undefined;
}

async function loadAllItemsForParent(
  host: UmbControllerHost,
  parentId: string | undefined,
): Promise<DocumentTypeTreeItemResponseModel[]> {
  const items: DocumentTypeTreeItemResponseModel[] = [];
  let skip = 0;

  while (true) {
    const page = await loadTreePage(host, parentId, skip);
    if (!page?.items.length) {
      break;
    }

    items.push(...page.items);

    if (items.length >= page.total || page.items.length < TREE_PAGE_SIZE) {
      break;
    }

    skip += TREE_PAGE_SIZE;
  }

  return items;
}

async function loadAllDocumentTypeUniques(host: UmbControllerHost): Promise<string[]> {
  const ids: string[] = [];

  async function walk(parentId: string | undefined) {
    const items = await loadAllItemsForParent(host, parentId);

    for (const item of items) {
      if (item.isFolder) {
        await walk(item.id);
        continue;
      }

      if (!item.isElement && item.id) {
        ids.push(item.id);
      }
    }
  }

  await walk(undefined);
  return ids;
}

export async function loadFieldVisibilityPageTypeOptions(
  host: UmbControllerHost,
): Promise<FieldVisibilityPageTypeOption[]> {
  const structureRepository = new UmbDocumentTypeStructureRepository(host);
  const itemRepository = new UmbDocumentTypeItemRepository(host);
  const uniques = new Set<string>();

  const { data: rootData } = await structureRepository.requestAllowedChildrenOf(null, null);
  for (const item of rootData?.items ?? []) {
    uniques.add(item.unique);
  }

  const parentDocumentTypeUniques = await loadAllDocumentTypeUniques(host);

  for (let index = 0; index < parentDocumentTypeUniques.length; index += PARENT_CHUNK_SIZE) {
    const chunk = parentDocumentTypeUniques.slice(index, index + PARENT_CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (parentUnique) => {
        const { data: childrenData } = await structureRepository.requestAllowedChildrenOf(
          parentUnique,
          null,
        );
        for (const child of childrenData?.items ?? []) {
          uniques.add(child.unique);
        }
      }),
    );
  }

  const uniqueList = [...uniques];
  if (!uniqueList.length) {
    return [];
  }

  const { data: items } = await itemRepository.requestItems(uniqueList);
  const nameByUnique = new Map((items ?? []).map((item) => [item.unique, item.name]));

  return uniqueList
    .map((unique) => ({
      unique,
      name: nameByUnique.get(unique) ?? unique,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
