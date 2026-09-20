var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};

// src/utils/load-element-type-properties.ts
import {
  UmbDocumentTypeDetailRepository
} from "@umbraco-cms/backoffice/document-type";
async function loadDocumentTypesWithCompositions(host, rootUnique) {
  const repository = new UmbDocumentTypeDetailRepository(host);
  const loaded = /* @__PURE__ */ new Map();
  const pending = [rootUnique];
  while (pending.length > 0) {
    const batch = [...new Set(pending.splice(0, pending.length))].filter((id) => !loaded.has(id));
    if (!batch.length) {
      break;
    }
    const { data } = await repository.requestByUniques(batch);
    for (const documentType of data ?? []) {
      loaded.set(documentType.unique, documentType);
      for (const composition of documentType.compositions ?? []) {
        const compositionUnique = composition.contentType.unique;
        if (!loaded.has(compositionUnique)) {
          pending.push(compositionUnique);
        }
      }
    }
  }
  const ordered = [];
  const root = loaded.get(rootUnique);
  if (root) {
    ordered.push(root);
  }
  for (const documentType of loaded.values()) {
    if (documentType.unique !== rootUnique) {
      ordered.push(documentType);
    }
  }
  return ordered;
}
async function loadElementTypeProperties(host, elementTypeKey) {
  if (!elementTypeKey) {
    return [];
  }
  const documentTypes = await loadDocumentTypesWithCompositions(host, elementTypeKey);
  const seenAliases = /* @__PURE__ */ new Set();
  const properties = [];
  for (const documentType of documentTypes) {
    for (const property2 of documentType.properties ?? []) {
      if (seenAliases.has(property2.alias)) {
        continue;
      }
      seenAliases.add(property2.alias);
      properties.push({
        alias: property2.alias,
        name: property2.name ?? property2.alias
      });
    }
  }
  return properties;
}

// src/styles/field-visibility-row.styles.ts
import { css } from "@umbraco-cms/backoffice/external/lit";
var UmbFieldVisibilityRowStyles = css`
  .field-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--uui-size-space-4);
    padding: var(--uui-size-space-4) 0;
    border-bottom: 1px solid var(--uui-color-divider);
  }

  .field-row:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .field-row:first-child {
    padding-top: 0;
  }

  .field-label {
    display: flex;
    flex-direction: column;
    gap: var(--uui-size-space-1);
    min-width: 0;
    flex: 1;
  }

  .field-name {
    font-weight: 700;
  }

  .field-alias {
    font-size: var(--uui-type-small-size, 0.85em);
    color: var(--uui-color-text-alt);
  }

  .help-text {
    margin: 0 0 var(--uui-size-layout-1);
    color: var(--uui-color-text-alt);
  }

  .status-text {
    margin: 0 0 var(--uui-size-space-3);
    color: var(--uui-color-text-alt);
    font-size: var(--uui-type-small-size, 0.9em);
  }

  .error-text {
    margin: 0 0 var(--uui-size-space-3);
    color: var(--uui-color-danger);
  }
`;

// src/components/block-field-visibility-block-editor.element.ts
import { css as css2, html, nothing, property, state } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
var BLOCK_EDITOR_TAG = "umb-block-field-visibility-block-editor";
var UmbBlockFieldVisibilityBlockEditorElement = class extends UmbLitElement {
  constructor() {
    super(...arguments);
    this.blockName = "";
    this.fieldVisibility = {};
    this.settingsFieldVisibility = {};
    this.hideHeadline = false;
    this._contentProperties = [];
    this._settingsProperties = [];
  }
  updated(changed) {
    if (changed.has("contentElementTypeKey") || changed.has("settingsElementTypeKey")) {
      void this.#loadProperties();
    }
  }
  async #loadProperties() {
    this._contentProperties = await loadElementTypeProperties(this, this.contentElementTypeKey);
    this._settingsProperties = this.settingsElementTypeKey ? await loadElementTypeProperties(this, this.settingsElementTypeKey) : [];
  }
  #emitContentChange(alias, hide) {
    this.dispatchEvent(
      new CustomEvent("field-visibility-change", {
        detail: { target: "content", alias, hide },
        bubbles: true,
        composed: true
      })
    );
  }
  #emitSettingsChange(alias, hide) {
    this.dispatchEvent(
      new CustomEvent("field-visibility-change", {
        detail: { target: "settings", alias, hide },
        bubbles: true,
        composed: true
      })
    );
  }
  render() {
    const inner = html`
      ${this._contentProperties.length ? html`
            <uui-box headline="Content">
              ${this._contentProperties.map(
      (property2) => this.#renderRow(
        property2,
        this.fieldVisibility,
        (hide) => this.#emitContentChange(property2.alias, hide)
      )
    )}
            </uui-box>
          ` : html`<p class="uui-text">No content properties found.</p>`}

      ${this.settingsElementTypeKey ? html`
            ${this._settingsProperties.length ? html`
                  <uui-box headline="Settings">
                    ${this._settingsProperties.map(
      (property2) => this.#renderRow(
        property2,
        this.settingsFieldVisibility,
        (hide) => this.#emitSettingsChange(property2.alias, hide)
      )
    )}
                  </uui-box>
                ` : html`<p class="uui-text">No settings properties found.</p>`}
          ` : nothing}
    `;
    if (this.hideHeadline) {
      return html`<div class="editor-inner">${inner}</div>`;
    }
    return html`<uui-box headline=${this.blockName || "Block type"}>${inner}</uui-box>`;
  }
  #renderRow(property2, map, onChange) {
    const hide = map[property2.alias] === true;
    return html`
      <div class="field-row">
        <div class="field-label">
          <span class="field-name">${property2.name}</span>
          <span class="field-alias">${property2.alias}</span>
        </div>
        <uui-toggle
          .checked=${hide}
          @change=${(e) => {
      const target = e.target;
      onChange(target.checked === true);
    }}
          label="Hide"
        ></uui-toggle>
      </div>
    `;
  }
  static {
    this.styles = [
      UmbTextStyles,
      UmbFieldVisibilityRowStyles,
      css2`
      :host {
        display: block;
      }

      uui-box {
        display: block;
        margin-top: var(--uui-size-layout-1);
      }

      uui-box:first-of-type {
        margin-top: 0;
      }

      uui-box .field-row {
        padding-left: 0;
        padding-right: 0;
      }
    `
    ];
  }
};
__decorateClass([
  property({ type: String, attribute: false })
], UmbBlockFieldVisibilityBlockEditorElement.prototype, "blockName", 2);
__decorateClass([
  property({ type: String, attribute: false })
], UmbBlockFieldVisibilityBlockEditorElement.prototype, "contentElementTypeKey", 2);
__decorateClass([
  property({ type: String, attribute: false })
], UmbBlockFieldVisibilityBlockEditorElement.prototype, "settingsElementTypeKey", 2);
__decorateClass([
  property({ type: Object, attribute: false })
], UmbBlockFieldVisibilityBlockEditorElement.prototype, "fieldVisibility", 2);
__decorateClass([
  property({ type: Object, attribute: false })
], UmbBlockFieldVisibilityBlockEditorElement.prototype, "settingsFieldVisibility", 2);
__decorateClass([
  property({ type: Boolean, attribute: "hide-headline" })
], UmbBlockFieldVisibilityBlockEditorElement.prototype, "hideHeadline", 2);
__decorateClass([
  state()
], UmbBlockFieldVisibilityBlockEditorElement.prototype, "_contentProperties", 2);
__decorateClass([
  state()
], UmbBlockFieldVisibilityBlockEditorElement.prototype, "_settingsProperties", 2);
if (!customElements.get(BLOCK_EDITOR_TAG)) {
  customElements.define(BLOCK_EDITOR_TAG, UmbBlockFieldVisibilityBlockEditorElement);
}
var block_field_visibility_block_editor_element_default = UmbBlockFieldVisibilityBlockEditorElement;

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

// src/block-list-field-visibility-runtime-sync.ts
import { UmbControllerBase } from "@umbraco-cms/backoffice/class-api";
import { UMB_BLOCK_MANAGER_CONTEXT } from "@umbraco-cms/backoffice/block";
var BLOCK_LIST_EDITOR_TAG = "umb-property-editor-ui-block-list";
var SYNC_FLAG = "__umbracoBlockFieldVisibilityListSync";
var UmbBlockListFieldVisibilityRuntimeSync = class extends UmbControllerBase {
  #blockManager;
  #onDataTypeUpdated = (event) => {
    const detail = event.detail;
    if (!detail?.blocks?.length) {
      return;
    }
    this.#mergeBlockTypes(detail.blocks);
  };
  #onElementTypeUpdated = (event) => {
    const detail = event.detail;
    if (!detail?.contentElementTypeKey) {
      return;
    }
    const manager = this.#blockManager;
    if (!manager) {
      return;
    }
    const current = manager.getBlockTypes();
    const next = current.map(
      (block) => block.contentElementTypeKey === detail.contentElementTypeKey ? {
        ...block,
        fieldVisibility: { ...detail.fieldVisibility },
        settingsFieldVisibility: { ...detail.settingsFieldVisibility }
      } : block
    );
    manager.setBlockTypes(next);
  };
  constructor(host) {
    super(host);
    this.consumeContext(UMB_BLOCK_MANAGER_CONTEXT, (manager) => {
      this.#blockManager = manager ?? void 0;
    });
    window.addEventListener(BLOCK_FIELD_VISIBILITY_DATA_TYPE_UPDATED, this.#onDataTypeUpdated);
    window.addEventListener(BLOCK_ELEMENT_TYPE_VISIBILITY_UPDATED, this.#onElementTypeUpdated);
  }
  #mergeBlockTypes(blocks) {
    const manager = this.#blockManager;
    if (!manager) {
      return;
    }
    const current = manager.getBlockTypes();
    const next = current.map((block) => {
      const updated = blocks.find((entry) => entry.contentElementTypeKey === block.contentElementTypeKey);
      if (!updated) {
        return block;
      }
      return {
        ...block,
        fieldVisibility: { ...updated.fieldVisibility ?? {} },
        settingsFieldVisibility: { ...updated.settingsFieldVisibility ?? {} }
      };
    });
    manager.setBlockTypes(next);
  }
  destroy() {
    window.removeEventListener(BLOCK_FIELD_VISIBILITY_DATA_TYPE_UPDATED, this.#onDataTypeUpdated);
    window.removeEventListener(BLOCK_ELEMENT_TYPE_VISIBILITY_UPDATED, this.#onElementTypeUpdated);
    super.destroy();
  }
};
function attachBlockListFieldVisibilityRuntimeSync() {
  void customElements.whenDefined(BLOCK_LIST_EDITOR_TAG).then(() => {
    const constructor = customElements.get(BLOCK_LIST_EDITOR_TAG);
    if (!constructor) {
      return;
    }
    const prototype = constructor.prototype;
    if (prototype[SYNC_FLAG]) {
      return;
    }
    const originalConnected = prototype.connectedCallback;
    prototype.connectedCallback = function() {
      originalConnected?.call(this);
      const flag = SYNC_FLAG;
      if (this[flag]) {
        return;
      }
      this[flag] = new UmbBlockListFieldVisibilityRuntimeSync(this);
    };
  });
}

// src/backoffice-entry-point.ts
var PROPERTY_ACTION_API = "/App_Plugins/Umbraco.BlockFieldVisibility/block-field-visibility.property-action.js";
async function onInit(_host, extensionRegistry) {
  attachBlockListFieldVisibilityRuntimeSync();
  extensionRegistry.register({
    type: "propertyAction",
    kind: "default",
    alias: "Umbraco.BlockFieldVisibility.PropertyAction",
    name: "Block Field Visibility Property Action",
    api: PROPERTY_ACTION_API,
    forPropertyEditorUis: ["Umb.PropertyEditorUi.BlockList"],
    weight: 500,
    meta: {
      label: "Field visibility",
      icon: "icon-eye"
    }
  });
}
export {
  onInit
};
