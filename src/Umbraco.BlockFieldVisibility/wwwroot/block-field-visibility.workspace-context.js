// src/utils/apply-property-view-guard-rules.ts
var VIEW_RULE_PREFIX = "Umbraco.BlockFieldVisibility.Hide.View.";
function safeRemoveOurRules(guard, prefix) {
  try {
    const ours = guard.getRules().filter((rule) => String(rule.unique).startsWith(prefix)).map((rule) => rule.unique);
    if (ours.length) {
      guard.removeRules(ours);
    }
  } catch {
  }
}
function safeAddDenyRules(guard, prefix, properties, visibility) {
  for (const [alias, hide] of Object.entries(visibility)) {
    if (hide !== true) {
      continue;
    }
    const property = properties.find((entry) => entry.alias === alias);
    if (!property?.unique) {
      continue;
    }
    try {
      guard.addRule({
        unique: `${prefix}${property.unique}`,
        permitted: false,
        propertyType: {
          unique: property.unique
        }
      });
    } catch {
      return;
    }
  }
}
async function applyPropertyViewGuardRules(host, visibility) {
  try {
    host.propertyViewGuard.clearRules();
    host.propertyViewGuard.fallbackToPermitted();
  } catch {
    return;
  }
  await syncDocumentHideRules(host, visibility);
}
async function syncDocumentHideRules(host, visibility) {
  try {
    await host.structure.whenLoaded();
  } catch {
    return;
  }
  safeRemoveOurRules(host.propertyViewGuard, VIEW_RULE_PREFIX);
  if (!visibility || !Object.values(visibility).some((hide) => hide === true)) {
    return;
  }
  let properties;
  try {
    properties = await host.structure.getContentTypeProperties();
  } catch {
    return;
  }
  if (!properties.length) {
    return;
  }
  safeAddDenyRules(host.propertyViewGuard, VIEW_RULE_PREFIX, properties, visibility);
}

// src/utils/schedule-visibility-resync.ts
var DEFAULT_DELAYS_MS = [300, 900];
function scheduleVisibilityResync(run, delaysMs = DEFAULT_DELAYS_MS) {
  const timerIds = [];
  for (const delay of delaysMs) {
    timerIds.push(
      window.setTimeout(() => {
        void run();
      }, delay)
    );
  }
  return () => {
    for (const id of timerIds) {
      window.clearTimeout(id);
    }
  };
}

// src/utils/block-field-visibility-data-type-events.ts
var BLOCK_FIELD_VISIBILITY_DATA_TYPE_UPDATED = "umbraco-block-field-visibility-data-type-updated";
var BLOCK_ELEMENT_TYPE_VISIBILITY_UPDATED = "umbraco-block-element-type-visibility-updated";
function notifyBlockFieldVisibilityDataTypeUpdated(dataTypeUnique, blocks) {
  window.dispatchEvent(
    new CustomEvent(BLOCK_FIELD_VISIBILITY_DATA_TYPE_UPDATED, {
      detail: { dataTypeUnique, blocks }
    })
  );
}
function notifyBlockElementTypeVisibilityUpdated(contentElementTypeKey, fieldVisibility, settingsFieldVisibility) {
  window.dispatchEvent(
    new CustomEvent(BLOCK_ELEMENT_TYPE_VISIBILITY_UPDATED, {
      detail: {
        contentElementTypeKey,
        fieldVisibility,
        settingsFieldVisibility
      }
    })
  );
}

// src/workspace/block-field-visibility.workspace-context.ts
import { UmbControllerBase } from "@umbraco-cms/backoffice/class-api";
import { UMB_BLOCK_MANAGER_CONTEXT, UMB_BLOCK_WORKSPACE_CONTEXT } from "@umbraco-cms/backoffice/block";
import { observeMultiple } from "@umbraco-cms/backoffice/observable-api";
var UmbBlockFieldVisibilityWorkspaceContext = class extends UmbControllerBase {
  #blockManager;
  #blockWorkspace;
  #resyncTimer;
  #lastContentTypeId;
  #lastSettingsTypeId;
  #lastBlockTypes = [];
  #patchManagerBlockTypes(contentElementTypeKey, patch) {
    if (!this.#blockManager) {
      return;
    }
    const current = this.#blockManager.getBlockTypes();
    if (!current.some((block) => block.contentElementTypeKey === contentElementTypeKey)) {
      return;
    }
    const next = current.map(
      (block) => block.contentElementTypeKey === contentElementTypeKey ? { ...block, ...patch } : block
    );
    this.#blockManager.setBlockTypes(next);
  }
  #onDataTypeUpdated = (event) => {
    const detail = event.detail;
    if (!detail?.blocks?.length || !this.#blockManager) {
      return;
    }
    const current = this.#blockManager.getBlockTypes();
    const next = current.map((block) => {
      const updated = detail.blocks.find((entry) => entry.contentElementTypeKey === block.contentElementTypeKey);
      if (!updated) {
        return block;
      }
      return {
        ...block,
        fieldVisibility: { ...updated.fieldVisibility ?? {} },
        settingsFieldVisibility: { ...updated.settingsFieldVisibility ?? {} }
      };
    });
    this.#blockManager.setBlockTypes(next);
    this.#lastBlockTypes = next;
    this.#scheduleResync();
  };
  #onElementTypeUpdated = (event) => {
    const detail = event.detail;
    if (!detail?.contentElementTypeKey) {
      return;
    }
    this.#patchManagerBlockTypes(detail.contentElementTypeKey, {
      fieldVisibility: { ...detail.fieldVisibility },
      settingsFieldVisibility: { ...detail.settingsFieldVisibility }
    });
    this.#scheduleResync();
  };
  constructor(host) {
    super(host);
    window.addEventListener(BLOCK_FIELD_VISIBILITY_DATA_TYPE_UPDATED, this.#onDataTypeUpdated);
    window.addEventListener(BLOCK_ELEMENT_TYPE_VISIBILITY_UPDATED, this.#onElementTypeUpdated);
    this.consumeContext(UMB_BLOCK_WORKSPACE_CONTEXT, (blockWorkspace) => {
      this.#blockWorkspace = blockWorkspace ?? void 0;
      if (!blockWorkspace) {
        return;
      }
      this.consumeContext(UMB_BLOCK_MANAGER_CONTEXT, (blockManager) => {
        if (!blockManager) {
          return;
        }
        this.#blockManager = blockManager;
        const syncRules = async (contentTypeId, settingsTypeId, blockTypes) => {
          if (!this.#blockWorkspace) {
            return;
          }
          await this.#blockWorkspace.content.structure.whenLoaded();
          const blockType = contentTypeId ? blockTypes.find((entry) => entry.contentElementTypeKey === contentTypeId) : void 0;
          await syncDocumentHideRules(this.#blockWorkspace.content, blockType?.fieldVisibility);
          if (settingsTypeId && blockType?.settingsElementTypeKey === settingsTypeId) {
            await this.#blockWorkspace.settings.structure.whenLoaded();
            await syncDocumentHideRules(this.#blockWorkspace.settings, blockType.settingsFieldVisibility);
          } else {
            await syncDocumentHideRules(this.#blockWorkspace.settings, void 0);
          }
        };
        this.observe(
          observeMultiple([
            blockWorkspace.content.contentTypeId,
            blockWorkspace.settings.contentTypeId,
            blockManager.blockTypes
          ]),
          async ([contentTypeId, settingsTypeId, blockTypes]) => {
            this.#lastContentTypeId = contentTypeId;
            this.#lastSettingsTypeId = settingsTypeId;
            this.#lastBlockTypes = blockTypes ?? [];
            await syncRules(contentTypeId, settingsTypeId, this.#lastBlockTypes);
            this.#scheduleResync();
          },
          "Umbraco.BlockFieldVisibility.SyncRules"
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
    const blockTypes = this.#blockManager?.getBlockTypes();
    if (blockTypes?.length) {
      this.#lastBlockTypes = blockTypes;
    }
    const contentTypeId = this.#lastContentTypeId;
    const settingsTypeId = this.#lastSettingsTypeId;
    await blockWorkspace.content.structure.whenLoaded();
    const blockType = contentTypeId ? this.#lastBlockTypes.find((entry) => entry.contentElementTypeKey === contentTypeId) : void 0;
    await syncDocumentHideRules(blockWorkspace.content, blockType?.fieldVisibility);
    if (settingsTypeId && blockType?.settingsElementTypeKey === settingsTypeId) {
      await blockWorkspace.settings.structure.whenLoaded();
      await syncDocumentHideRules(blockWorkspace.settings, blockType.settingsFieldVisibility);
    } else {
      await syncDocumentHideRules(blockWorkspace.settings, void 0);
    }
  }
  destroy() {
    if (this.#resyncTimer) {
      window.clearTimeout(this.#resyncTimer);
    }
    window.removeEventListener(BLOCK_FIELD_VISIBILITY_DATA_TYPE_UPDATED, this.#onDataTypeUpdated);
    window.removeEventListener(BLOCK_ELEMENT_TYPE_VISIBILITY_UPDATED, this.#onElementTypeUpdated);
    super.destroy();
  }
};
export {
  UmbBlockFieldVisibilityWorkspaceContext as api
};
