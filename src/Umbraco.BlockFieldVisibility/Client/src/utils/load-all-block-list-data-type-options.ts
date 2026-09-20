import type { UmbControllerHost } from "@umbraco-cms/backoffice/controller-api";
import {
  DataTypeService,
  type DataTypeTreeItemResponseModel,
} from "@umbraco-cms/backoffice/external/backend-api";
import { tryExecute } from "@umbraco-cms/backoffice/resources";

const BLOCK_LIST_EDITOR_UI = "Umb.PropertyEditorUi.BlockList";
const TREE_PAGE_SIZE = 100;

export type BlockListDataTypeOption = {
  unique: string;
  name: string;
};

async function loadTreePage(
  host: UmbControllerHost,
  parentId: string | undefined,
  skip: number,
): Promise<{ items: DataTypeTreeItemResponseModel[]; total: number } | undefined> {
  if (parentId === undefined) {
    const { data } = await tryExecute(
      host,
      DataTypeService.getTreeDataTypeRoot({
        query: { skip, take: TREE_PAGE_SIZE, foldersOnly: false },
      }),
    );
    return data ? { items: data.items, total: data.total } : undefined;
  }

  const { data } = await tryExecute(
    host,
    DataTypeService.getTreeDataTypeChildren({
      query: { parentId, skip, take: TREE_PAGE_SIZE, foldersOnly: false },
    }),
  );
  return data ? { items: data.items, total: data.total } : undefined;
}

async function loadAllTreeItems(
  host: UmbControllerHost,
  parentId: string | undefined,
): Promise<DataTypeTreeItemResponseModel[]> {
  const items: DataTypeTreeItemResponseModel[] = [];
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

export async function loadAllBlockListDataTypeOptions(
  host: UmbControllerHost,
): Promise<BlockListDataTypeOption[]> {
  const options: BlockListDataTypeOption[] = [];

  async function walk(parentId: string | undefined) {
    const items = await loadAllTreeItems(host, parentId);

    for (const item of items) {
      if (item.isFolder) {
        await walk(item.id);
        continue;
      }

      if (item.editorUiAlias === BLOCK_LIST_EDITOR_UI && item.id) {
        options.push({
          unique: item.id,
          name: item.name,
        });
      }
    }
  }

  await walk(undefined);

  return options.sort((a, b) => a.name.localeCompare(b.name));
}
