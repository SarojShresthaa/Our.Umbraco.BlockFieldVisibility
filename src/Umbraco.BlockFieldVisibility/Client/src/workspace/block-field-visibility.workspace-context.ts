import { UmbControllerBase } from "@umbraco-cms/backoffice/class-api";
import type { UmbControllerHost } from "@umbraco-cms/backoffice/controller-api";
import { UMB_BLOCK_MANAGER_CONTEXT, UMB_BLOCK_WORKSPACE_CONTEXT } from "@umbraco-cms/backoffice/block";
import { observeMultiple } from "@umbraco-cms/backoffice/observable-api";
import type { UmbBlockTypeWithFieldVisibility } from "../types.js";
import { syncDocumentHideRules } from "../utils/apply-property-view-guard-rules.js";
import { scheduleVisibilityResync } from "../utils/schedule-visibility-resync.js";
import {
  BLOCK_ELEMENT_TYPE_VISIBILITY_UPDATED,
  BLOCK_FIELD_VISIBILITY_DATA_TYPE_UPDATED,
  type BlockElementTypeVisibilityUpdatedDetail,
  type BlockFieldVisibilityDataTypeUpdatedDetail,
} from "../utils/block-field-visibility-data-type-events.js";

class UmbBlockFieldVisibilityWorkspaceContext extends UmbControllerBase {
  #blockManager?: typeof UMB_BLOCK_MANAGER_CONTEXT.TYPE;
  #blockWorkspace?: typeof UMB_BLOCK_WORKSPACE_CONTEXT.TYPE;
  #resyncTimer?: number;
  #lastContentTypeId?: string;
  #lastSettingsTypeId?: string;
  #lastBlockTypes: UmbBlockTypeWithFieldVisibility[] = [];

  #patchManagerBlockTypes(contentElementTypeKey: string, patch: Partial<UmbBlockTypeWithFieldVisibility>) {
    if (!this.#blockManager) {
      return;
    }

    const current = this.#blockManager.getBlockTypes() as UmbBlockTypeWithFieldVisibility[];
    if (!current.some((block) => block.contentElementTypeKey === contentElementTypeKey)) {
      return;
    }

    const next = current.map((block) =>
      block.contentElementTypeKey === contentElementTypeKey ? { ...block, ...patch } : block,
    );
    this.#blockManager.setBlockTypes(next);
  }

  #onDataTypeUpdated = (event: Event) => {
    const detail = (event as CustomEvent<BlockFieldVisibilityDataTypeUpdatedDetail>).detail;
    if (!detail?.blocks?.length || !this.#blockManager) {
      return;
    }

    const current = this.#blockManager.getBlockTypes() as UmbBlockTypeWithFieldVisibility[];
    const next = current.map((block) => {
      const updated = detail.blocks.find((entry) => entry.contentElementTypeKey === block.contentElementTypeKey);
      if (!updated) {
        return block;
      }
      return {
        ...block,
        fieldVisibility: { ...(updated.fieldVisibility ?? {}) },
        settingsFieldVisibility: { ...(updated.settingsFieldVisibility ?? {}) },
      };
    });

    this.#blockManager.setBlockTypes(next);
    this.#lastBlockTypes = next;
    this.#scheduleResync();
  };

  #onElementTypeUpdated = (event: Event) => {
    const detail = (event as CustomEvent<BlockElementTypeVisibilityUpdatedDetail>).detail;
    if (!detail?.contentElementTypeKey) {
      return;
    }

    this.#patchManagerBlockTypes(detail.contentElementTypeKey, {
      fieldVisibility: { ...detail.fieldVisibility },
      settingsFieldVisibility: { ...detail.settingsFieldVisibility },
    });
    this.#scheduleResync();
  };

  constructor(host: UmbControllerHost) {
    super(host);

    window.addEventListener(BLOCK_FIELD_VISIBILITY_DATA_TYPE_UPDATED, this.#onDataTypeUpdated);
    window.addEventListener(BLOCK_ELEMENT_TYPE_VISIBILITY_UPDATED, this.#onElementTypeUpdated);

    this.consumeContext(UMB_BLOCK_WORKSPACE_CONTEXT, (blockWorkspace) => {
      this.#blockWorkspace = blockWorkspace ?? undefined;
      if (!blockWorkspace) {
        return;
      }

      this.consumeContext(UMB_BLOCK_MANAGER_CONTEXT, (blockManager) => {
        if (!blockManager) {
          return;
        }

        this.#blockManager = blockManager;

        const syncRules = async (
          contentTypeId: string | undefined,
          settingsTypeId: string | undefined,
          blockTypes: UmbBlockTypeWithFieldVisibility[],
        ) => {
          if (!this.#blockWorkspace) {
            return;
          }

          await this.#blockWorkspace.content.structure.whenLoaded();

          const blockType = contentTypeId
            ? blockTypes.find((entry) => entry.contentElementTypeKey === contentTypeId)
            : undefined;

          await syncDocumentHideRules(this.#blockWorkspace.content, blockType?.fieldVisibility);

          if (settingsTypeId && blockType?.settingsElementTypeKey === settingsTypeId) {
            await this.#blockWorkspace.settings.structure.whenLoaded();
            await syncDocumentHideRules(this.#blockWorkspace.settings, blockType.settingsFieldVisibility);
          } else {
            await syncDocumentHideRules(this.#blockWorkspace.settings, undefined);
          }
        };

        this.observe(
          observeMultiple([
            blockWorkspace.content.contentTypeId,
            blockWorkspace.settings.contentTypeId,
            blockManager.blockTypes,
          ]),
          async ([contentTypeId, settingsTypeId, blockTypes]) => {
            this.#lastContentTypeId = contentTypeId;
            this.#lastSettingsTypeId = settingsTypeId;
            this.#lastBlockTypes = (blockTypes ?? []) as UmbBlockTypeWithFieldVisibility[];
            await syncRules(contentTypeId, settingsTypeId, this.#lastBlockTypes);
            this.#scheduleResync();
          },
          "Umbraco.BlockFieldVisibility.SyncRules",
        );

        this.observe(blockWorkspace.content.structure.contentTypeLoaded, (loaded) => {
          if (loaded) {
            this.#scheduleResync();
          }
        });

        void blockWorkspace.content.structure.whenLoaded().then((loaded) => {
          if (loaded) {
            this.#scheduleResync();
            scheduleVisibilityResync(() => this.#scheduleResync());
          }
        });
      });
    });
  }

  #scheduleResync() {
    if (!this.#blockWorkspace || !this.#blockManager) {
      return;
    }

    if (this.#resyncTimer) {
      window.clearTimeout(this.#resyncTimer);
    }

    this.#resyncTimer = window.setTimeout(() => {
      void this.#resyncNow();
    }, 120);
  }

  async #resyncNow() {
    const blockWorkspace = this.#blockWorkspace;
    if (!blockWorkspace) {
      return;
    }

    const blockTypes = this.#blockManager?.getBlockTypes() as UmbBlockTypeWithFieldVisibility[] | undefined;
    if (blockTypes?.length) {
      this.#lastBlockTypes = blockTypes;
    }

    const contentTypeId = this.#lastContentTypeId;
    const settingsTypeId = this.#lastSettingsTypeId;

    await blockWorkspace.content.structure.whenLoaded();

    const blockType = contentTypeId
      ? this.#lastBlockTypes.find((entry) => entry.contentElementTypeKey === contentTypeId)
      : undefined;

    await syncDocumentHideRules(blockWorkspace.content, blockType?.fieldVisibility);

    if (settingsTypeId && blockType?.settingsElementTypeKey === settingsTypeId) {
      await blockWorkspace.settings.structure.whenLoaded();
      await syncDocumentHideRules(blockWorkspace.settings, blockType.settingsFieldVisibility);
    } else {
      await syncDocumentHideRules(blockWorkspace.settings, undefined);
    }
  }

  override destroy() {
    if (this.#resyncTimer) {
      window.clearTimeout(this.#resyncTimer);
    }
    window.removeEventListener(BLOCK_FIELD_VISIBILITY_DATA_TYPE_UPDATED, this.#onDataTypeUpdated);
    window.removeEventListener(BLOCK_ELEMENT_TYPE_VISIBILITY_UPDATED, this.#onElementTypeUpdated);
    super.destroy();
  }
}

export { UmbBlockFieldVisibilityWorkspaceContext as api };
