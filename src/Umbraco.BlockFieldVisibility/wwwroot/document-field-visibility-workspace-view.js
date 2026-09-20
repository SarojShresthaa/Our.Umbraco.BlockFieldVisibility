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

// src/utils/build-document-visibility-layout.ts
import {
  UmbContentTypeContainerStructureHelper,
  UmbContentTypePropertyStructureHelper
} from "@umbraco-cms/backoffice/content-type";
import { firstValueFrom } from "@umbraco-cms/backoffice/external/rxjs";
function toListItems(properties) {
  return [...properties].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map((property) => ({
    alias: property.alias,
    name: property.name ?? property.alias
  }));
}
async function propertiesAtContainer(host, structure, containerId) {
  const propertyHelper = new UmbContentTypePropertyStructureHelper(host);
  propertyHelper.setStructureManager(structure);
  propertyHelper.setContainerId(containerId);
  return toListItems(await firstValueFrom(propertyHelper.propertyStructure));
}
async function sectionsForContainer(host, structure, containerId) {
  const groupHelper = new UmbContentTypeContainerStructureHelper(host);
  groupHelper.setStructureManager(structure);
  groupHelper.setContainerChildType("Group");
  groupHelper.setContainerId(containerId);
  const [groups, hasDirectProperties] = await Promise.all([
    firstValueFrom(groupHelper.childContainers),
    firstValueFrom(groupHelper.hasProperties)
  ]);
  const sections = [];
  if (hasDirectProperties) {
    const properties = await propertiesAtContainer(host, structure, containerId);
    if (properties.length) {
      sections.push({ name: "", showHeadline: false, properties });
    }
  }
  for (const group of groups) {
    const groupContainerId = group.ids[0] ?? null;
    const properties = await propertiesAtContainer(host, structure, groupContainerId);
    if (!properties.length) {
      continue;
    }
    sections.push({
      name: group.name ?? "Group",
      showHeadline: true,
      properties
    });
  }
  return sections;
}
async function buildDocumentVisibilityLayout(host, structure) {
  await structure.whenLoaded();
  const tabsHelper = new UmbContentTypeContainerStructureHelper(host);
  tabsHelper.setStructureManager(structure);
  tabsHelper.setIsRoot(true);
  tabsHelper.setContainerChildType("Tab");
  const [tabContainers, hasRootProperties, hasRootGroupsObservable] = await Promise.all([
    firstValueFrom(tabsHelper.childContainers),
    firstValueFrom(tabsHelper.hasProperties),
    structure.hasRootContainers("Group")
  ]);
  const hasRootGroups = await firstValueFrom(hasRootGroupsObservable);
  const tabs = [];
  if (hasRootProperties || hasRootGroups) {
    const sections = await sectionsForContainer(host, structure, null);
    if (sections.length) {
      tabs.push({
        key: "root",
        name: "#general_generic",
        sections
      });
    }
  }
  for (const tab of tabContainers) {
    const tabContainerId = tab.ownerId ?? tab.ids[0];
    const sections = await sectionsForContainer(host, structure, tabContainerId);
    if (!sections.length) {
      continue;
    }
    tabs.push({
      key: tabContainerId,
      name: tab.name ?? "Tab",
      sections
    });
  }
  return { tabs, showTabBar: tabs.length > 1 };
}

// src/utils/apply-property-view-guard-rules.ts
var RULE_PREFIX = "Umbraco.BlockFieldVisibility.Hide.";
async function applyPropertyViewGuardRules(host, visibility) {
  host.propertyViewGuard.clearRules();
  host.propertyViewGuard.fallbackToPermitted();
  await syncDocumentHideRules(host, visibility);
}
async function syncDocumentHideRules(host, visibility) {
  const guard = host.propertyViewGuard;
  const ours = guard.getRules().filter((rule) => String(rule.unique).startsWith(RULE_PREFIX)).map((rule) => rule.unique);
  if (ours.length) {
    guard.removeRules(ours);
  }
  if (!visibility) {
    return;
  }
  for (const [alias, hide] of Object.entries(visibility)) {
    if (hide !== true) {
      continue;
    }
    const property = await host.structure.getPropertyStructureByAlias(alias);
    if (!property) {
      continue;
    }
    guard.addRule({
      unique: `${RULE_PREFIX}${property.unique}`,
      permitted: false,
      propertyType: {
        unique: property.unique
      }
    });
  }
}

// src/utils/document-type-field-visibility-storage.ts
var MARKER_START = "\n__UMBRACO_BLOCK_FIELD_VISIBILITY__\n";
var MARKER_END = "\n__END_UMBRACO_BLOCK_FIELD_VISIBILITY__\n";
var memoryByContentType = /* @__PURE__ */ new Map();
function cacheFieldVisibilityInMemory(contentTypeUnique, fieldVisibility) {
  memoryByContentType.set(contentTypeUnique, { ...fieldVisibility });
}
function getFieldVisibilityFromDocumentType(documentType) {
  if (!documentType?.unique) {
    return {};
  }
  const cached = memoryByContentType.get(documentType.unique);
  if (cached) {
    return { ...cached };
  }
  return parseFromDescription(documentType.description ?? "");
}
function setFieldVisibilityOnDocumentType(documentType, fieldVisibility) {
  memoryByContentType.set(documentType.unique, { ...fieldVisibility });
  const withoutMarker = stripFieldVisibilityMarker(documentType.description ?? "");
  const payload = JSON.stringify(fieldVisibility);
  const description = withoutMarker.trim().length > 0 ? `${withoutMarker.trim()}${MARKER_START}${payload}${MARKER_END}` : `${MARKER_START}${payload}${MARKER_END}`;
  return { ...documentType, description };
}
function parseFromDescription(description) {
  const start = description.indexOf(MARKER_START);
  if (start === -1) {
    return parseLegacyHtmlComment(description);
  }
  const jsonStart = start + MARKER_START.length;
  const end = description.indexOf(MARKER_END, jsonStart);
  if (end === -1) {
    return {};
  }
  return parseJsonMap(description.slice(jsonStart, end));
}
function parseLegacyHtmlComment(description) {
  const legacyMarker = "<!-- umbraco-block-field-visibility:";
  const legacyEnd = " -->";
  const start = description.indexOf(legacyMarker);
  if (start === -1) {
    return {};
  }
  const jsonStart = start + legacyMarker.length;
  const end = description.indexOf(legacyEnd, jsonStart);
  if (end === -1) {
    return {};
  }
  return parseJsonMap(description.slice(jsonStart, end));
}
function parseJsonMap(raw) {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? { ...parsed } : {};
  } catch {
    return {};
  }
}
function stripFieldVisibilityMarker(description) {
  let result = description;
  const start = result.indexOf(MARKER_START);
  if (start !== -1) {
    const end = result.indexOf(MARKER_END, start);
    if (end !== -1) {
      result = (result.slice(0, start) + result.slice(end + MARKER_END.length)).trim();
    }
  }
  const legacyStart = result.indexOf("<!-- umbraco-block-field-visibility:");
  if (legacyStart !== -1) {
    const legacyEnd = result.indexOf(" -->", legacyStart);
    if (legacyEnd !== -1) {
      result = (result.slice(0, legacyStart) + result.slice(legacyEnd + 4)).trim();
    }
  }
  return result;
}
var DOCUMENT_TYPE_FIELD_VISIBILITY_UPDATED = "umbraco-block-field-visibility-document-type-updated";
function notifyDocumentTypeFieldVisibilityUpdated(contentTypeUnique, fieldVisibility) {
  cacheFieldVisibilityInMemory(contentTypeUnique, fieldVisibility);
  window.dispatchEvent(
    new CustomEvent(DOCUMENT_TYPE_FIELD_VISIBILITY_UPDATED, {
      detail: { contentTypeUnique, fieldVisibility }
    })
  );
}

// src/utils/document-field-visibility-persistence.ts
var LOCAL_STORAGE_KEY = "umbraco.block-field-visibility.v1";
var API_BASE = "/umbraco/management/api/v1/block-field-visibility";
function readLocalStore() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}
function saveFieldVisibilityToLocalStorage(contentTypeUnique, fieldVisibility) {
  const store = readLocalStore();
  store[contentTypeUnique] = { ...fieldVisibility };
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));
  cacheFieldVisibilityInMemory(contentTypeUnique, fieldVisibility);
}
function loadFromLocalStorage(contentTypeUnique) {
  const map = readLocalStore()[contentTypeUnique];
  return map ? { ...map } : void 0;
}
async function loadFieldVisibilityFromServer(contentTypeUnique) {
  try {
    const response = await fetch(`${API_BASE}/${encodeURIComponent(contentTypeUnique)}`, {
      credentials: "include"
    });
    if (!response.ok) {
      return void 0;
    }
    const data = await response.json();
    return typeof data === "object" && data !== null ? { ...data } : {};
  } catch {
    return void 0;
  }
}
async function saveFieldVisibilityToServer(contentTypeUnique, fieldVisibility) {
  try {
    const response = await fetch(`${API_BASE}/${encodeURIComponent(contentTypeUnique)}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fieldVisibility)
    });
    return response.ok;
  } catch {
    return false;
  }
}
async function resolveFieldVisibility(contentTypeUnique, documentType) {
  const fromServer = await loadFieldVisibilityFromServer(contentTypeUnique);
  if (fromServer) {
    saveFieldVisibilityToLocalStorage(contentTypeUnique, fromServer);
    return fromServer;
  }
  const fromDocumentType = getFieldVisibilityFromDocumentType(documentType);
  if (Object.keys(fromDocumentType).length > 0) {
    saveFieldVisibilityToLocalStorage(contentTypeUnique, fromDocumentType);
    return fromDocumentType;
  }
  const fromLocal = loadFromLocalStorage(contentTypeUnique);
  if (fromLocal) {
    cacheFieldVisibilityInMemory(contentTypeUnique, fromLocal);
    return fromLocal;
  }
  return {};
}

// src/views/document-field-visibility-workspace-view.element.ts
var _documentTypeRepository, _documentWorkspace, _contentTypeUnique, _UmbDocumentFieldVisibilityWorkspaceViewElement_instances, load_fn, applyHideRules_fn, setVisibility_fn, activeTab_fn, tabLabel_fn, renderTab_fn, renderRow_fn;
import { css, customElement, html, nothing, repeat, state } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import { UMB_DOCUMENT_WORKSPACE_CONTEXT } from "@umbraco-cms/backoffice/document";
import { UmbDocumentTypeDetailRepository } from "@umbraco-cms/backoffice/document-type";
var UmbDocumentFieldVisibilityWorkspaceViewElement = class extends UmbLitElement {
  constructor() {
    super();
    __privateAdd(this, _UmbDocumentFieldVisibilityWorkspaceViewElement_instances);
    __privateAdd(this, _documentTypeRepository, new UmbDocumentTypeDetailRepository(this));
    __privateAdd(this, _documentWorkspace);
    __privateAdd(this, _contentTypeUnique);
    this._layout = { tabs: [], showTabBar: false };
    this._activeTabKey = "";
    this._fieldVisibility = {};
    this._loading = true;
    this._saving = false;
    this.consumeContext(UMB_DOCUMENT_WORKSPACE_CONTEXT, (workspace) => {
      __privateSet(this, _documentWorkspace, workspace);
      if (!workspace) {
        this._loading = false;
        return;
      }
      const reload = () => {
        void __privateMethod(this, _UmbDocumentFieldVisibilityWorkspaceViewElement_instances, load_fn).call(this, workspace);
      };
      this.observe(workspace.structure.contentTypeLoaded, (loaded) => {
        if (loaded) {
          reload();
        }
      });
      void workspace.structure.whenLoaded().then((loaded) => {
        if (loaded) {
          reload();
        }
      });
    });
  }
  render() {
    const activeTab = __privateMethod(this, _UmbDocumentFieldVisibilityWorkspaceViewElement_instances, activeTab_fn).call(this);
    return html`

      <umb-body-layout header-fit-height>

        ${this._layout.showTabBar ? html`

              <uui-tab-group slot="header">

                ${repeat(
      this._layout.tabs,
      (tab) => tab.key,
      (tab) => html`

                    <uui-tab

                      .label=${__privateMethod(this, _UmbDocumentFieldVisibilityWorkspaceViewElement_instances, tabLabel_fn).call(this, tab)}

                      ?active=${tab.key === this._activeTabKey}

                      @click=${() => {
        this._activeTabKey = tab.key;
      }}

                    ></uui-tab>

                  `
    )}

              </uui-tab-group>

            ` : nothing}



        <div id="layout">

          <p class="help">

            Choose which properties are hidden on the Content tab for pages of this type. Layout matches the Content

            editor (tabs and groups). Hidden fields keep their stored values; only the backoffice UI is affected.

          </p>



          ${this._loading ? html`<uui-loader></uui-loader>` : nothing}

          ${this._saving ? html`<uui-loader></uui-loader>` : nothing}

          ${this._error ? html`<p class="error">${this._error}</p>` : nothing}

          ${!this._loading && !this._layout.tabs.length ? html`<p>No properties are configured on this document type.</p>` : nothing}



          ${activeTab ? __privateMethod(this, _UmbDocumentFieldVisibilityWorkspaceViewElement_instances, renderTab_fn).call(this, activeTab) : nothing}

        </div>

      </umb-body-layout>

    `;
  }
};
_documentTypeRepository = new WeakMap();
_documentWorkspace = new WeakMap();
_contentTypeUnique = new WeakMap();
_UmbDocumentFieldVisibilityWorkspaceViewElement_instances = new WeakSet();
load_fn = async function(workspace) {
  const contentTypeUnique = workspace.getContentTypeUnique();
  if (!contentTypeUnique) {
    this._loading = false;
    this._layout = { tabs: [], showTabBar: false };
    return;
  }
  __privateSet(this, _contentTypeUnique, contentTypeUnique);
  this._loading = true;
  this._error = void 0;
  try {
    const [{ data: documentType }, layout] = await Promise.all([
      __privateGet(this, _documentTypeRepository).requestByUnique(contentTypeUnique),
      buildDocumentVisibilityLayout(this, workspace.structure)
    ]);
    this._fieldVisibility = await resolveFieldVisibility(contentTypeUnique, documentType);
    await __privateMethod(this, _UmbDocumentFieldVisibilityWorkspaceViewElement_instances, applyHideRules_fn).call(this, this._fieldVisibility);
    this._layout = layout;
    if (!this._activeTabKey || !layout.tabs.some((tab) => tab.key === this._activeTabKey)) {
      this._activeTabKey = layout.tabs[0]?.key ?? "";
    }
  } catch {
    this._error = "Could not load properties for this page type.";
    this._layout = { tabs: [], showTabBar: false };
  }
  this._loading = false;
};
applyHideRules_fn = async function(fieldVisibility) {
  const workspace = __privateGet(this, _documentWorkspace);
  if (!workspace) {
    return;
  }
  await workspace.structure.whenLoaded();
  await syncDocumentHideRules(workspace, fieldVisibility);
};
setVisibility_fn = async function(alias, hide) {
  if (!__privateGet(this, _contentTypeUnique)) {
    return;
  }
  const next = { ...this._fieldVisibility, [alias]: hide };
  this._fieldVisibility = next;
  notifyDocumentTypeFieldVisibilityUpdated(__privateGet(this, _contentTypeUnique), next);
  await __privateMethod(this, _UmbDocumentFieldVisibilityWorkspaceViewElement_instances, applyHideRules_fn).call(this, next);
  this._saving = true;
  this._error = void 0;
  saveFieldVisibilityToLocalStorage(__privateGet(this, _contentTypeUnique), next);
  const serverSaved = await saveFieldVisibilityToServer(__privateGet(this, _contentTypeUnique), next);
  const { data: documentType } = await __privateGet(this, _documentTypeRepository).requestByUnique(__privateGet(this, _contentTypeUnique));
  if (documentType) {
    await __privateGet(this, _documentTypeRepository).save(setFieldVisibilityOnDocumentType(documentType, next));
  }
  this._saving = false;
  if (!serverSaved) {
    this._error = "Could not save to the server. Hide rules work until you close the browser; restart the site and try again if this persists.";
  }
};
activeTab_fn = function() {
  return this._layout.tabs.find((tab) => tab.key === this._activeTabKey) ?? this._layout.tabs[0];
};
tabLabel_fn = function(tab) {
  if (tab.name === "#general_generic") {
    return this.localize.string("#general_generic");
  }
  return tab.name;
};
renderTab_fn = function(tab) {
  return html`

      ${repeat(
    tab.sections,
    (section, index) => `${section.name}-${index}`,
    (section) => html`

          ${section.showHeadline ? html`

                <uui-box .headline=${section.name}>

                  ${section.properties.map((property) => __privateMethod(this, _UmbDocumentFieldVisibilityWorkspaceViewElement_instances, renderRow_fn).call(this, property))}

                </uui-box>

              ` : html`

                <uui-box>

                  ${section.properties.map((property) => __privateMethod(this, _UmbDocumentFieldVisibilityWorkspaceViewElement_instances, renderRow_fn).call(this, property))}

                </uui-box>

              `}

        `
  )}

    `;
};
renderRow_fn = function(property) {
  const hide = this._fieldVisibility[property.alias] === true;
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
    void __privateMethod(this, _UmbDocumentFieldVisibilityWorkspaceViewElement_instances, setVisibility_fn).call(this, property.alias, target.checked === true);
  }}

          label="Hide"

        ></uui-toggle>

      </div>

    `;
};
UmbDocumentFieldVisibilityWorkspaceViewElement.styles = [
  UmbTextStyles,
  css`

      :host {

        display: block;

        height: 100%;

      }



      #layout {

        padding: var(--uui-size-layout-1);

        padding-bottom: var(--uui-size-layout-2);

      }



      .help {

        margin-top: 0;

        margin-bottom: var(--uui-size-layout-1);

        color: var(--uui-color-text-alt);

      }



      .error {

        color: var(--uui-color-danger);

      }



      uui-box {

        --uui-box-default-padding: 0 var(--uui-size-space-5);

      }



      uui-box:not(:first-of-type) {

        margin-top: var(--uui-size-layout-1);

      }



      uui-tab-group {

        --uui-tab-divider: var(--uui-color-border);

        border-left: 1px solid var(--uui-color-border);

        border-right: 1px solid var(--uui-color-border);

      }



      .field-row {

        display: flex;

        align-items: center;

        justify-content: space-between;

        gap: var(--uui-size-space-4);

        padding: var(--uui-size-space-3) 0;

        border-bottom: 1px solid var(--uui-color-divider);

      }



      .field-row:last-child {

        border-bottom: none;

      }



      .field-label {

        display: flex;

        flex-direction: column;

        gap: var(--uui-size-space-1);

        min-width: 0;

      }



      .name {

        font-weight: 600;

      }



      .alias {

        font-size: 0.85em;

        color: var(--uui-color-text-alt);

      }

    `
];
__decorateClass([
  state()
], UmbDocumentFieldVisibilityWorkspaceViewElement.prototype, "_layout", 2);
__decorateClass([
  state()
], UmbDocumentFieldVisibilityWorkspaceViewElement.prototype, "_activeTabKey", 2);
__decorateClass([
  state()
], UmbDocumentFieldVisibilityWorkspaceViewElement.prototype, "_fieldVisibility", 2);
__decorateClass([
  state()
], UmbDocumentFieldVisibilityWorkspaceViewElement.prototype, "_loading", 2);
__decorateClass([
  state()
], UmbDocumentFieldVisibilityWorkspaceViewElement.prototype, "_error", 2);
__decorateClass([
  state()
], UmbDocumentFieldVisibilityWorkspaceViewElement.prototype, "_saving", 2);
UmbDocumentFieldVisibilityWorkspaceViewElement = __decorateClass([
  customElement("umb-document-field-visibility-workspace-view")
], UmbDocumentFieldVisibilityWorkspaceViewElement);
var document_field_visibility_workspace_view_element_default = UmbDocumentFieldVisibilityWorkspaceViewElement;
export {
  UmbDocumentFieldVisibilityWorkspaceViewElement,
  document_field_visibility_workspace_view_element_default as default
};
