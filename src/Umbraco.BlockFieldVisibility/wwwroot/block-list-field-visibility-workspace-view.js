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
    for (const property of documentType.properties ?? []) {
      if (seenAliases.has(property.alias)) {
        continue;
      }
      seenAliases.add(property.alias);
      properties.push({
        alias: property.alias,
        name: property.name ?? property.alias
      });
    }
  }
  return properties;
}

// src/views/block-list-field-visibility-workspace-view.element.ts
var _workspaceContext, _UmbBlockListFieldVisibilityWorkspaceViewElement_instances, setContentVisibility_fn, setSettingsVisibility_fn, renderRow_fn;
import { css, customElement, html, nothing, state } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import { UMB_BLOCK_TYPE_WORKSPACE_CONTEXT } from "@umbraco-cms/backoffice/block-type";
var UmbBlockListFieldVisibilityWorkspaceViewElement = class extends UmbLitElement {
  constructor() {
    super();
    __privateAdd(this, _UmbBlockListFieldVisibilityWorkspaceViewElement_instances);
    __privateAdd(this, _workspaceContext);
    this._contentProperties = [];
    this._settingsProperties = [];
    this._fieldVisibility = {};
    this._settingsFieldVisibility = {};
    this._hasSettingsElement = false;
    this.consumeContext(UMB_BLOCK_TYPE_WORKSPACE_CONTEXT, (context) => {
      __privateSet(this, _workspaceContext, context);
      this.observe(context?.unique, async (elementTypeKey) => {
        this._contentProperties = await loadElementTypeProperties(this, elementTypeKey);
      });
      this.observe(context?.data, async (data) => {
        const blockType = data;
        this._hasSettingsElement = !!blockType?.settingsElementTypeKey;
        this._fieldVisibility = { ...blockType?.fieldVisibility ?? {} };
        this._settingsFieldVisibility = { ...blockType?.settingsFieldVisibility ?? {} };
        if (blockType?.settingsElementTypeKey) {
          this._settingsProperties = await loadElementTypeProperties(this, blockType.settingsElementTypeKey);
        } else {
          this._settingsProperties = [];
        }
      });
    });
  }
  render() {
    return html`
      <uui-box headline="Field visibility">
        <p id="field-visibility-help">
          Choose which properties are hidden when editors work with this block in a Block List. Hidden fields keep
          their stored values; only the backoffice editor UI is affected.
        </p>

        ${this._contentProperties.length ? html`
              <h4>Content properties</h4>
              ${this._contentProperties.map((property) => __privateMethod(this, _UmbBlockListFieldVisibilityWorkspaceViewElement_instances, renderRow_fn).call(this, property, this._fieldVisibility, (hide) => __privateMethod(this, _UmbBlockListFieldVisibilityWorkspaceViewElement_instances, setContentVisibility_fn).call(this, property.alias, hide)))}
            ` : html`<p>No properties were found on this element type.</p>`}

        ${this._hasSettingsElement ? html`
              <h4>Settings properties</h4>
              ${this._settingsProperties.length ? this._settingsProperties.map(
      (property) => __privateMethod(this, _UmbBlockListFieldVisibilityWorkspaceViewElement_instances, renderRow_fn).call(this, property, this._settingsFieldVisibility, (hide) => __privateMethod(this, _UmbBlockListFieldVisibilityWorkspaceViewElement_instances, setSettingsVisibility_fn).call(this, property.alias, hide))
    ) : html`<p>No properties were found on the settings element type.</p>`}
            ` : nothing}
      </uui-box>
    `;
  }
};
_workspaceContext = new WeakMap();
_UmbBlockListFieldVisibilityWorkspaceViewElement_instances = new WeakSet();
setContentVisibility_fn = async function(alias, hide) {
  const next = { ...this._fieldVisibility, [alias]: hide };
  this._fieldVisibility = next;
  await __privateGet(this, _workspaceContext)?.setPropertyValue("fieldVisibility", next);
};
setSettingsVisibility_fn = async function(alias, hide) {
  const next = { ...this._settingsFieldVisibility, [alias]: hide };
  this._settingsFieldVisibility = next;
  await __privateGet(this, _workspaceContext)?.setPropertyValue("settingsFieldVisibility", next);
};
renderRow_fn = function(property, map, onChange) {
  const hide = map[property.alias] === true;
  return html`
      <div class="field-row">
        <div class="field-label">
          <span class="name">${property.name}</span>
          <span class="alias">${property.alias}</span>
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
};
UmbBlockListFieldVisibilityWorkspaceViewElement.styles = [
  UmbTextStyles,
  css`
      :host {
        display: block;
        margin: var(--uui-size-layout-1);
        padding-bottom: var(--uui-size-layout-1);
      }

      #field-visibility-help {
        margin-top: 0;
        color: var(--uui-color-text-alt);
      }

      h4 {
        margin: var(--uui-size-layout-1) 0 var(--uui-size-space-3);
      }

      .field-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--uui-size-space-4);
        padding: var(--uui-size-space-3) 0;
        border-bottom: 1px solid var(--uui-color-border);
      }

      .field-row:last-child {
        border-bottom: none;
      }

      .field-label {
        display: flex;
        flex-direction: column;
        gap: var(--uui-size-space-1);
      }

      .name {
        font-weight: 600;
      }

      .alias {
        font-size: 0.85em;
        color: var(--uui-color-text-alt);
      }

      uui-toggle {
        flex-shrink: 0;
      }
    `
];
__decorateClass([
  state()
], UmbBlockListFieldVisibilityWorkspaceViewElement.prototype, "_contentProperties", 2);
__decorateClass([
  state()
], UmbBlockListFieldVisibilityWorkspaceViewElement.prototype, "_settingsProperties", 2);
__decorateClass([
  state()
], UmbBlockListFieldVisibilityWorkspaceViewElement.prototype, "_fieldVisibility", 2);
__decorateClass([
  state()
], UmbBlockListFieldVisibilityWorkspaceViewElement.prototype, "_settingsFieldVisibility", 2);
__decorateClass([
  state()
], UmbBlockListFieldVisibilityWorkspaceViewElement.prototype, "_hasSettingsElement", 2);
UmbBlockListFieldVisibilityWorkspaceViewElement = __decorateClass([
  customElement("umb-block-list-field-visibility-workspace-view")
], UmbBlockListFieldVisibilityWorkspaceViewElement);
var block_list_field_visibility_workspace_view_element_default = UmbBlockListFieldVisibilityWorkspaceViewElement;
export {
  UmbBlockListFieldVisibilityWorkspaceViewElement,
  block_list_field_visibility_workspace_view_element_default as default
};
