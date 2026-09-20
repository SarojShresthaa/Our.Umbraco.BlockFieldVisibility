var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);

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

// src/modals/block-field-visibility-modal.element.ts
var _dataTypeRepository, _documentTypeItems, _UmbBlockFieldVisibilityModalElement_instances, load_fn, onVisibilityChange_fn, save_fn;
import { css, customElement, html, nothing, state } from "@umbraco-cms/backoffice/external/lit";
import { UmbModalBaseElement } from "@umbraco-cms/backoffice/modal";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import { UmbDataTypeDetailRepository } from "@umbraco-cms/backoffice/data-type";
import {
  UmbDocumentTypeItemRepository
} from "@umbraco-cms/backoffice/document-type";
var UmbBlockFieldVisibilityModalElement = class extends UmbModalBaseElement {
  constructor() {
    super(...arguments);
    __privateAdd(this, _UmbBlockFieldVisibilityModalElement_instances);
    __privateAdd(this, _dataTypeRepository, new UmbDataTypeDetailRepository(this));
    __privateAdd(this, _documentTypeItems, new UmbDocumentTypeItemRepository(this));
    this._blocks = [];
    this._names = /* @__PURE__ */ new Map();
    this._loading = true;
  }
  connectedCallback() {
    super.connectedCallback();
    void __privateMethod(this, _UmbBlockFieldVisibilityModalElement_instances, load_fn).call(this);
  }
  render() {
    return html`
      <umb-body-layout headline=${this.data?.headline ?? "Field visibility"}>
        <uui-button slot="actions" label="Close" @click=${this._rejectModal}></uui-button>
        <uui-button slot="actions" look="primary" color="positive" label="Save" @click=${__privateMethod(this, _UmbBlockFieldVisibilityModalElement_instances, save_fn)}></uui-button>

        <div id="layout">
          <p class="help">
            Configure which block properties are hidden in the editor. This applies to this Block List everywhere it is
            used (including content in the tree). Stored values are not removed.
          </p>

          ${this._loading ? html`<uui-loader></uui-loader>` : nothing}
          ${this._error ? html`<p class="error">${this._error}</p>` : nothing}
          ${!this._loading && !this._blocks.length ? html`<p>No block types are configured on this data type.</p>` : nothing}

          ${this._blocks.map(
      (block) => html`
              <umb-block-field-visibility-block-editor
                .blockName=${this._names.get(block.contentElementTypeKey) ?? block.contentElementTypeKey}
                .contentElementTypeKey=${block.contentElementTypeKey}
                .settingsElementTypeKey=${block.settingsElementTypeKey}
                .fieldVisibility=${block.fieldVisibility ?? {}}
                .settingsFieldVisibility=${block.settingsFieldVisibility ?? {}}
                @field-visibility-change=${(e) => __privateMethod(this, _UmbBlockFieldVisibilityModalElement_instances, onVisibilityChange_fn).call(this, block.contentElementTypeKey, e)}
              ></umb-block-field-visibility-block-editor>
            `
    )}
        </div>
      </umb-body-layout>
    `;
  }
};
_dataTypeRepository = new WeakMap();
_documentTypeItems = new WeakMap();
_UmbBlockFieldVisibilityModalElement_instances = new WeakSet();
load_fn = async function() {
  const unique = this.data?.dataTypeUnique;
  if (!unique) {
    this._error = "Data type could not be resolved.";
    this._loading = false;
    return;
  }
  const { data, error } = await __privateGet(this, _dataTypeRepository).requestByUnique(unique);
  if (error || !data) {
    this._error = "Could not load the Block List data type.";
    this._loading = false;
    return;
  }
  this._blocks = getBlocksFromDataType(data).map((b) => ({
    ...b,
    fieldVisibility: { ...b.fieldVisibility ?? {} },
    settingsFieldVisibility: { ...b.settingsFieldVisibility ?? {} }
  }));
  const keys = this._blocks.flatMap(
    (b) => [b.contentElementTypeKey, b.settingsElementTypeKey].filter(Boolean)
  );
  if (keys.length) {
    const { data: items } = await __privateGet(this, _documentTypeItems).requestItems(keys);
    const map = /* @__PURE__ */ new Map();
    (items ?? []).forEach((item) => map.set(item.unique, item.name));
    this._names = map;
  }
  this._loading = false;
};
onVisibilityChange_fn = function(contentElementTypeKey, event) {
  const { target, alias, hide } = event.detail;
  this._blocks = this._blocks.map((block) => {
    if (block.contentElementTypeKey !== contentElementTypeKey) {
      return block;
    }
    if (target === "content") {
      return {
        ...block,
        fieldVisibility: { ...block.fieldVisibility ?? {}, [alias]: hide }
      };
    }
    return {
      ...block,
      settingsFieldVisibility: { ...block.settingsFieldVisibility ?? {}, [alias]: hide }
    };
  });
};
save_fn = async function() {
  const unique = this.data?.dataTypeUnique;
  if (!unique) {
    return;
  }
  const { data } = await __privateGet(this, _dataTypeRepository).requestByUnique(unique);
  if (!data) {
    return;
  }
  const toSave = setBlocksOnDataType(data, this._blocks);
  const { error } = await __privateGet(this, _dataTypeRepository).save(toSave);
  if (error) {
    this._error = "Could not save. You may need permission to edit data types.";
    return;
  }
  notifyBlockFieldVisibilityDataTypeUpdated(unique, this._blocks);
  this.value = true;
  this._submitModal();
};
UmbBlockFieldVisibilityModalElement.styles = [
  UmbTextStyles,
  css`
      #layout {
        padding: var(--uui-size-layout-1);
      }

      .help {
        color: var(--uui-color-text-alt);
        margin-top: 0;
      }

      .error {
        color: var(--uui-color-danger);
      }

      umb-block-field-visibility-block-editor {
        display: block;
        margin-bottom: var(--uui-size-space-4);
      }
    `
];
__decorateClass([
  state()
], UmbBlockFieldVisibilityModalElement.prototype, "_blocks", 2);
__decorateClass([
  state()
], UmbBlockFieldVisibilityModalElement.prototype, "_names", 2);
__decorateClass([
  state()
], UmbBlockFieldVisibilityModalElement.prototype, "_loading", 2);
__decorateClass([
  state()
], UmbBlockFieldVisibilityModalElement.prototype, "_error", 2);
UmbBlockFieldVisibilityModalElement = __decorateClass([
  customElement("umb-block-field-visibility-modal")
], UmbBlockFieldVisibilityModalElement);
var block_field_visibility_modal_element_default = UmbBlockFieldVisibilityModalElement;
export {
  UmbBlockFieldVisibilityModalElement,
  block_field_visibility_modal_element_default as default
};
