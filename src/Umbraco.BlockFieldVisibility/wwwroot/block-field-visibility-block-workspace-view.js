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
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);

// src/utils/get-block-list-property-alias-from-route.ts
function getBlockListPropertyAliasFromRoute() {
  const path = window.location.pathname;
  const blockSegment = "/block/";
  const blockIndex = path.indexOf(blockSegment);
  if (blockIndex === -1) {
    return void 0;
  }
  const beforeBlock = path.slice(0, blockIndex).replace(/\/$/, "");
  const segments = beforeBlock.split("/").filter(Boolean);
  const alias = segments.at(-1);
  return alias && alias.length > 0 ? alias : void 0;
}

// src/utils/try-optional-context.ts
async function tryOptionalContext(host, token, options = { skipHost: true }) {
  try {
    return await host.getContext(token, options);
  } catch {
    return void 0;
  }
}
async function tryOptionalAncestorContext(host, token) {
  return tryOptionalContext(host, token, {
    skipHost: true,
    passContextAliasMatches: true
  });
}

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

// src/utils/patch-block-type-visibility.ts
function patchBlockTypeVisibility(blocks, contentElementTypeKey, target, alias, hide) {
  return blocks.map((block) => {
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
}

// src/views/block-field-visibility-block-workspace-view.element.ts
var _blockManager, _dataTypeRepository, _documentTypeItems, _UmbBlockFieldVisibilityBlockWorkspaceViewElement_instances, resolveDataTypeUnique_fn, syncFromBlockManager_fn, applyVisibilityChange_fn;
import { css, customElement, html, nothing, state } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import { UMB_BLOCK_MANAGER_CONTEXT, UMB_BLOCK_WORKSPACE_CONTEXT } from "@umbraco-cms/backoffice/block";
import { UMB_PROPERTY_CONTEXT } from "@umbraco-cms/backoffice/property";
import { UMB_CONTENT_WORKSPACE_CONTEXT } from "@umbraco-cms/backoffice/content";
import { UmbDataTypeDetailRepository } from "@umbraco-cms/backoffice/data-type";
import {
  UmbDocumentTypeItemRepository
} from "@umbraco-cms/backoffice/document-type";
var UmbBlockFieldVisibilityBlockWorkspaceViewElement = class extends UmbLitElement {
  constructor() {
    super();
    __privateAdd(this, _UmbBlockFieldVisibilityBlockWorkspaceViewElement_instances);
    __privateAdd(this, _blockManager);
    __privateAdd(this, _dataTypeRepository, new UmbDataTypeDetailRepository(this));
    __privateAdd(this, _documentTypeItems, new UmbDocumentTypeItemRepository(this));
    this._blockName = "";
    this._fieldVisibility = {};
    this._settingsFieldVisibility = {};
    this._saving = false;
    this.consumeContext(UMB_BLOCK_MANAGER_CONTEXT, (blockManager) => {
      __privateSet(this, _blockManager, blockManager);
    });
    this.consumeContext(UMB_BLOCK_WORKSPACE_CONTEXT, (blockWorkspace) => {
      this.observe(blockWorkspace?.content.contentTypeId, (contentTypeId) => {
        this._contentElementTypeKey = contentTypeId;
        void __privateMethod(this, _UmbBlockFieldVisibilityBlockWorkspaceViewElement_instances, syncFromBlockManager_fn).call(this);
      });
    });
  }
  render() {
    if (!this._contentElementTypeKey) {
      return html`<p class="help">Open a block to configure field visibility.</p>`;
    }
    return html`
      <div id="layout">
        <p class="help">
          Choose which properties are hidden on the Content and Settings tabs for this block type. Stored values are
          kept; only the editor UI is affected. Changes apply everywhere this Block List is used.
        </p>

        ${this._error ? html`<p class="error">${this._error}</p>` : nothing}
        ${this._saving ? html`<uui-loader></uui-loader>` : nothing}

        <umb-block-field-visibility-block-editor
          .blockName=${this._blockName}
          .contentElementTypeKey=${this._contentElementTypeKey}
          .settingsElementTypeKey=${this._settingsElementTypeKey}
          .fieldVisibility=${this._fieldVisibility}
          .settingsFieldVisibility=${this._settingsFieldVisibility}
          @field-visibility-change=${(e) => __privateMethod(this, _UmbBlockFieldVisibilityBlockWorkspaceViewElement_instances, applyVisibilityChange_fn).call(this, e)}
        ></umb-block-field-visibility-block-editor>
      </div>
    `;
  }
};
_blockManager = new WeakMap();
_dataTypeRepository = new WeakMap();
_documentTypeItems = new WeakMap();
_UmbBlockFieldVisibilityBlockWorkspaceViewElement_instances = new WeakSet();
resolveDataTypeUnique_fn = async function() {
  if (this._dataTypeUnique) {
    return this._dataTypeUnique;
  }
  const contentWorkspace = await tryOptionalAncestorContext(this, UMB_CONTENT_WORKSPACE_CONTEXT);
  if (!contentWorkspace) {
    return void 0;
  }
  const propertyContext = await tryOptionalContext(this, UMB_PROPERTY_CONTEXT, { skipHost: true });
  const alias = propertyContext?.getAlias() ?? getBlockListPropertyAliasFromRoute();
  if (!alias) {
    return void 0;
  }
  const propertyStructure = await contentWorkspace.structure.getPropertyStructureByAlias(alias);
  this._dataTypeUnique = propertyStructure?.dataType.unique;
  return this._dataTypeUnique;
};
syncFromBlockManager_fn = async function() {
  const key = this._contentElementTypeKey;
  if (!key || !__privateGet(this, _blockManager)) {
    return;
  }
  const blockType = __privateGet(this, _blockManager).getBlockTypes().find((b) => b.contentElementTypeKey === key);
  if (!blockType) {
    return;
  }
  this._settingsElementTypeKey = blockType.settingsElementTypeKey;
  this._fieldVisibility = { ...blockType.fieldVisibility ?? {} };
  this._settingsFieldVisibility = { ...blockType.settingsFieldVisibility ?? {} };
  const { data: items } = await __privateGet(this, _documentTypeItems).requestItems([key]);
  const item = (items ?? [])[0];
  this._blockName = item?.name ?? key;
};
applyVisibilityChange_fn = async function(event) {
  const key = this._contentElementTypeKey;
  if (!key || !__privateGet(this, _blockManager)) {
    return;
  }
  const { target, alias, hide } = event.detail;
  const blocks = patchBlockTypeVisibility(
    __privateGet(this, _blockManager).getBlockTypes(),
    key,
    target,
    alias,
    hide
  );
  const updated = blocks.find((b) => b.contentElementTypeKey === key);
  if (updated) {
    this._fieldVisibility = { ...updated.fieldVisibility ?? {} };
    this._settingsFieldVisibility = { ...updated.settingsFieldVisibility ?? {} };
  }
  __privateGet(this, _blockManager).setBlockTypes(blocks);
  const propertyContext = await tryOptionalContext(this, UMB_PROPERTY_CONTEXT);
  if (propertyContext) {
    propertyContext.setConfig(updatePropertyConfigBlocks(propertyContext.getConfig(), blocks));
  }
  const dataTypeUnique = await __privateMethod(this, _UmbBlockFieldVisibilityBlockWorkspaceViewElement_instances, resolveDataTypeUnique_fn).call(this);
  if (!dataTypeUnique) {
    this._error = "Could not resolve the Block List data type. Changes apply in this session only.";
    return;
  }
  this._saving = true;
  this._error = void 0;
  const { data } = await __privateGet(this, _dataTypeRepository).requestByUnique(dataTypeUnique);
  if (!data) {
    this._error = "Could not load the Block List data type.";
    this._saving = false;
    return;
  }
  const { error } = await __privateGet(this, _dataTypeRepository).save(setBlocksOnDataType(data, blocks));
  this._saving = false;
  if (error) {
    this._error = "Could not save. You may need permission to edit data types.";
  }
};
UmbBlockFieldVisibilityBlockWorkspaceViewElement.styles = [
  UmbTextStyles,
  css`
      :host {
        display: block;
      }

      #layout {
        margin: var(--uui-size-layout-1);
        padding-bottom: var(--uui-size-layout-1);
      }

      .help {
        margin-top: 0;
        color: var(--uui-color-text-alt);
      }

      .error {
        color: var(--uui-color-danger);
      }
    `
];
__decorateClass([
  state()
], UmbBlockFieldVisibilityBlockWorkspaceViewElement.prototype, "_contentElementTypeKey", 2);
__decorateClass([
  state()
], UmbBlockFieldVisibilityBlockWorkspaceViewElement.prototype, "_blockName", 2);
__decorateClass([
  state()
], UmbBlockFieldVisibilityBlockWorkspaceViewElement.prototype, "_settingsElementTypeKey", 2);
__decorateClass([
  state()
], UmbBlockFieldVisibilityBlockWorkspaceViewElement.prototype, "_fieldVisibility", 2);
__decorateClass([
  state()
], UmbBlockFieldVisibilityBlockWorkspaceViewElement.prototype, "_settingsFieldVisibility", 2);
__decorateClass([
  state()
], UmbBlockFieldVisibilityBlockWorkspaceViewElement.prototype, "_dataTypeUnique", 2);
__decorateClass([
  state()
], UmbBlockFieldVisibilityBlockWorkspaceViewElement.prototype, "_error", 2);
__decorateClass([
  state()
], UmbBlockFieldVisibilityBlockWorkspaceViewElement.prototype, "_saving", 2);
UmbBlockFieldVisibilityBlockWorkspaceViewElement = __decorateClass([
  customElement("umb-block-field-visibility-block-workspace-view")
], UmbBlockFieldVisibilityBlockWorkspaceViewElement);
var block_field_visibility_block_workspace_view_element_default = UmbBlockFieldVisibilityBlockWorkspaceViewElement;
export {
  UmbBlockFieldVisibilityBlockWorkspaceViewElement,
  block_field_visibility_block_workspace_view_element_default as default
};
