import { UmbControllerBase } from "@umbraco-cms/backoffice/class-api";
import type { UmbControllerHost } from "@umbraco-cms/backoffice/controller-api";
import { UMB_BLOCK_MANAGER_CONTEXT } from "@umbraco-cms/backoffice/block";
import type { UmbBlockTypeWithFieldVisibility } from "./types.js";
import {
  BLOCK_ELEMENT_TYPE_VISIBILITY_UPDATED,
  BLOCK_FIELD_VISIBILITY_DATA_TYPE_UPDATED,
  type BlockElementTypeVisibilityUpdatedDetail,
  type BlockFieldVisibilityDataTypeUpdatedDetail,
} from "./utils/block-field-visibility-data-type-events.js";

const BLOCK_LIST_EDITOR_TAG = "umb-property-editor-ui-block-list";
const SYNC_FLAG = "__umbracoBlockFieldVisibilityListSync";

type BlockListEditorElement = HTMLElement & UmbControllerHost;

/**
 * Keeps Block List managers on open document pages in sync when visibility is saved from the dashboard.
 */
class UmbBlockListFieldVisibilityRuntimeSync extends UmbControllerBase {
  #blockManager?: typeof UMB_BLOCK_MANAGER_CONTEXT.TYPE;

  #onDataTypeUpdated = (event: Event) => {
    const detail = (event as CustomEvent<BlockFieldVisibilityDataTypeUpdatedDetail>).detail;
    if (!detail?.blocks?.length) {
      return;
    }
    this.#mergeBlockTypes(detail.blocks);
  };

  #onElementTypeUpdated = (event: Event) => {
    const detail = (event as CustomEvent<BlockElementTypeVisibilityUpdatedDetail>).detail;
    if (!detail?.contentElementTypeKey) {
      return;
    }

    const manager = this.#blockManager;
    if (!manager) {
      return;
    }

    const current = manager.getBlockTypes() as UmbBlockTypeWithFieldVisibility[];
    const next = current.map((block) =>
      block.contentElementTypeKey === detail.contentElementTypeKey
        ? {
            ...block,
            fieldVisibility: { ...detail.fieldVisibility },
            settingsFieldVisibility: { ...detail.settingsFieldVisibility },
          }
        : block,
    );
    manager.setBlockTypes(next);
  };

  constructor(host: UmbControllerHost) {
    super(host);

    this.consumeContext(UMB_BLOCK_MANAGER_CONTEXT, (manager) => {
      this.#blockManager = manager ?? undefined;
    });

    window.addEventListener(BLOCK_FIELD_VISIBILITY_DATA_TYPE_UPDATED, this.#onDataTypeUpdated);
    window.addEventListener(BLOCK_ELEMENT_TYPE_VISIBILITY_UPDATED, this.#onElementTypeUpdated);
  }

  #mergeBlockTypes(blocks: UmbBlockTypeWithFieldVisibility[]) {
    const manager = this.#blockManager;
    if (!manager) {
      return;
    }

    const current = manager.getBlockTypes() as UmbBlockTypeWithFieldVisibility[];
    const next = current.map((block) => {
      const updated = blocks.find((entry) => entry.contentElementTypeKey === block.contentElementTypeKey);
      if (!updated) {
        return block;
      }
      return {
        ...block,
        fieldVisibility: { ...(updated.fieldVisibility ?? {}) },
        settingsFieldVisibility: { ...(updated.settingsFieldVisibility ?? {}) },
      };
    });

    manager.setBlockTypes(next);
  }

  override destroy() {
    window.removeEventListener(BLOCK_FIELD_VISIBILITY_DATA_TYPE_UPDATED, this.#onDataTypeUpdated);
    window.removeEventListener(BLOCK_ELEMENT_TYPE_VISIBILITY_UPDATED, this.#onElementTypeUpdated);
    super.destroy();
  }
}

export function attachBlockListFieldVisibilityRuntimeSync() {
  void customElements.whenDefined(BLOCK_LIST_EDITOR_TAG).then(() => {
    const constructor = customElements.get(BLOCK_LIST_EDITOR_TAG);
    if (!constructor) {
      return;
    }

    const prototype = constructor.prototype as BlockListEditorElement & {
      connectedCallback?: () => void;
    };

    if (prototype[SYNC_FLAG as keyof typeof prototype]) {
      return;
    }

    const originalConnected = prototype.connectedCallback;
    prototype.connectedCallback = function (this: BlockListEditorElement) {
      originalConnected?.call(this);
      const flag = SYNC_FLAG as keyof BlockListEditorElement;
      if ((this as BlockListEditorElement & Record<string, unknown>)[flag as string]) {
        return;
      }
      (this as BlockListEditorElement & Record<string, unknown>)[flag as string] =
        new UmbBlockListFieldVisibilityRuntimeSync(this);
    };
  });
}
