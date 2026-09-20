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
  return [...properties].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map((property4) => ({
    alias: property4.alias,
    name: property4.name ?? property4.alias
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
import { UMB_AUTH_CONTEXT } from "@umbraco-cms/backoffice/auth";
var LOCAL_STORAGE_KEY = "umbraco.block-field-visibility.v1";
var API_PATH = "/umbraco/management/api/v1/block-field-visibility";
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
function normalizeFieldVisibilityMap(fieldVisibility) {
  const normalized = {};
  for (const [alias, hide] of Object.entries(fieldVisibility)) {
    if (hide === true) {
      normalized[alias] = true;
    }
  }
  return normalized;
}
function applyFieldVisibilityToggle(fieldVisibility, alias, hide) {
  const next = { ...fieldVisibility };
  if (hide) {
    next[alias] = true;
  } else {
    delete next[alias];
  }
  return normalizeFieldVisibilityMap(next);
}
function saveFieldVisibilityToLocalStorage(contentTypeUnique, fieldVisibility) {
  const normalized = normalizeFieldVisibilityMap(fieldVisibility);
  const store = readLocalStore();
  store[contentTypeUnique] = normalized;
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));
  cacheFieldVisibilityInMemory(contentTypeUnique, normalized);
}
function loadFromLocalStorage(contentTypeUnique) {
  const map = readLocalStore()[contentTypeUnique];
  return map ? { ...map } : void 0;
}
async function requestFieldVisibilityApi(host, documentTypeUnique, init) {
  const authContext = await host.getContext(UMB_AUTH_CONTEXT);
  if (!authContext) {
    return new Response(null, { status: 401, statusText: "Not authenticated" });
  }
  const openApi = authContext.getOpenApiConfiguration();
  const token = await openApi.token();
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (init?.body !== void 0 && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const base = openApi.base?.replace(/\/$/, "") ?? "";
  const url = `${base}${API_PATH}/${encodeURIComponent(documentTypeUnique)}`;
  return fetch(url, {
    ...init,
    credentials: openApi.credentials ?? "include",
    headers
  });
}
async function loadFieldVisibilityFromServer(host, contentTypeUnique) {
  try {
    const response = await requestFieldVisibilityApi(host, contentTypeUnique);
    if (response.status === 404) {
      return {};
    }
    if (!response.ok) {
      return void 0;
    }
    const data = await response.json();
    return typeof data === "object" && data !== null ? { ...data } : {};
  } catch {
    return void 0;
  }
}
async function saveFieldVisibilityToServer(host, contentTypeUnique, fieldVisibility) {
  const normalized = normalizeFieldVisibilityMap(fieldVisibility);
  try {
    const response = await requestFieldVisibilityApi(host, contentTypeUnique, {
      method: "PUT",
      body: JSON.stringify(normalized)
    });
    return response.ok;
  } catch {
    return false;
  }
}
async function resolveFieldVisibility(host, contentTypeUnique, documentType) {
  const fromServer = await loadFieldVisibilityFromServer(host, contentTypeUnique);
  if (fromServer !== void 0) {
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

// src/utils/field-visibility-notifications.ts
import { UMB_NOTIFICATION_CONTEXT } from "@umbraco-cms/backoffice/notification";
async function notifyFieldVisibilitySaved(host, label, hide) {
  const notificationContext = await host.getContext(UMB_NOTIFICATION_CONTEXT);
  if (!notificationContext) {
    return;
  }
  const message = hide ? `${label} is now hidden in the backoffice Content editor.` : `${label} is visible again in the backoffice Content editor.`;
  notificationContext.peek("positive", { data: { message } });
}
async function notifyFieldVisibilitySaveFailed(host, message) {
  const notificationContext = await host.getContext(UMB_NOTIFICATION_CONTEXT);
  if (!notificationContext) {
    return;
  }
  notificationContext.peek("danger", { data: { message } });
}
async function notifyFieldVisibilityBatchSaved(host, message, tone = "positive") {
  const notificationContext = await host.getContext(UMB_NOTIFICATION_CONTEXT);
  if (!notificationContext) {
    return;
  }
  notificationContext.peek(tone, { data: { message } });
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

// src/components/document-type-field-visibility-editor.element.ts
var _documentTypeRepository, _structure, _UmbDocumentTypeFieldVisibilityEditorElement_instances, load_fn, setVisibility_fn, activeTab_fn, tabLabel_fn, renderTab_fn, renderRow_fn;
import { css as css2, customElement, html, nothing, property, repeat, state } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import { UmbContentTypeStructureManager } from "@umbraco-cms/backoffice/content-type";
import {
  UmbDocumentTypeDetailRepository,
  UMB_DOCUMENT_TYPE_DETAIL_REPOSITORY_ALIAS
} from "@umbraco-cms/backoffice/document-type";
var UmbDocumentTypeFieldVisibilityEditorElement = class extends UmbLitElement {
  constructor() {
    super(...arguments);
    __privateAdd(this, _UmbDocumentTypeFieldVisibilityEditorElement_instances);
    this.documentTypeUnique = "";
    this.embedded = false;
    __privateAdd(this, _documentTypeRepository, new UmbDocumentTypeDetailRepository(this));
    __privateAdd(this, _structure, new UmbContentTypeStructureManager(this, UMB_DOCUMENT_TYPE_DETAIL_REPOSITORY_ALIAS));
    this._layout = { tabs: [], showTabBar: false };
    this._activeTabKey = "";
    this._fieldVisibility = {};
    this._loading = false;
    this._saving = false;
  }
  updated(changed) {
    if (changed.has("documentTypeUnique")) {
      void __privateMethod(this, _UmbDocumentTypeFieldVisibilityEditorElement_instances, load_fn).call(this);
    }
  }
  render() {
    if (!this.documentTypeUnique) {
      return nothing;
    }
    const activeTab = __privateMethod(this, _UmbDocumentTypeFieldVisibilityEditorElement_instances, activeTab_fn).call(this);
    const tabBar = this._layout.showTabBar ? html`
          <uui-tab-group slot=${this.embedded ? void 0 : "header"}>
            ${repeat(
      this._layout.tabs,
      (tab) => tab.key,
      (tab) => html`
                <uui-tab
                  .label=${__privateMethod(this, _UmbDocumentTypeFieldVisibilityEditorElement_instances, tabLabel_fn).call(this, tab)}
                  ?active=${tab.key === this._activeTabKey}
                  @click=${() => {
        this._activeTabKey = tab.key;
      }}
                ></uui-tab>
              `
    )}
          </uui-tab-group>
        ` : nothing;
    const body = html`
      ${tabBar}

      <p class="help-text uui-text">
        Choose which properties are hidden in the backoffice for this page type. Hidden fields keep their stored values.
      </p>

      ${this._loading ? html`<uui-loader></uui-loader>` : nothing}
      ${this._saving ? html`<p class="status-text">Saving…</p>` : nothing}
      ${this._error ? html`<p class="error-text">${this._error}</p>` : nothing}
      ${!this._loading && !this._layout.tabs.length ? html`<p class="uui-text">No properties are configured on this document type.</p>` : nothing}

      ${activeTab ? __privateMethod(this, _UmbDocumentTypeFieldVisibilityEditorElement_instances, renderTab_fn).call(this, activeTab) : nothing}
    `;
    if (this.embedded) {
      return body;
    }
    return html`<uui-box headline="Page properties">${body}</uui-box>`;
  }
};
_documentTypeRepository = new WeakMap();
_structure = new WeakMap();
_UmbDocumentTypeFieldVisibilityEditorElement_instances = new WeakSet();
load_fn = async function() {
  const contentTypeUnique = this.documentTypeUnique;
  if (!contentTypeUnique) {
    this._layout = { tabs: [], showTabBar: false };
    return;
  }
  this._loading = true;
  this._error = void 0;
  try {
    const [{ data: documentType }, layout] = await Promise.all([
      __privateGet(this, _documentTypeRepository).requestByUnique(contentTypeUnique),
      __privateGet(this, _structure).loadType(contentTypeUnique).then(() => buildDocumentVisibilityLayout(this, __privateGet(this, _structure)))
    ]);
    this._fieldVisibility = await resolveFieldVisibility(this, contentTypeUnique, documentType);
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
setVisibility_fn = async function(alias, hide, label) {
  const contentTypeUnique = this.documentTypeUnique;
  if (!contentTypeUnique) {
    return;
  }
  const next = applyFieldVisibilityToggle(this._fieldVisibility, alias, hide);
  this._fieldVisibility = next;
  notifyDocumentTypeFieldVisibilityUpdated(contentTypeUnique, next);
  this._saving = true;
  this._error = void 0;
  saveFieldVisibilityToLocalStorage(contentTypeUnique, next);
  const serverSaved = await saveFieldVisibilityToServer(this, contentTypeUnique, next);
  this._saving = false;
  if (!serverSaved) {
    const message = "Could not save field visibility to the server. Rules still apply in this browser until you sign out; check that you are signed in and try again.";
    this._error = message;
    await notifyFieldVisibilitySaveFailed(this, message);
  } else {
    this._error = void 0;
    await notifyFieldVisibilitySaved(this, label, hide);
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
                  ${section.properties.map((property4) => __privateMethod(this, _UmbDocumentTypeFieldVisibilityEditorElement_instances, renderRow_fn).call(this, property4))}
                </uui-box>
              ` : html`
                <uui-box>
                  ${section.properties.map((property4) => __privateMethod(this, _UmbDocumentTypeFieldVisibilityEditorElement_instances, renderRow_fn).call(this, property4))}
                </uui-box>
              `}
        `
  )}
    `;
};
renderRow_fn = function(property4) {
  const hide = this._fieldVisibility[property4.alias] === true;
  return html`
      <div class="field-row">
        <div class="field-label">
          <span class="field-name">${property4.name}</span>
          <span class="field-alias">${property4.alias}</span>
        </div>
        <uui-toggle
          .checked=${hide}
          @change=${(e) => {
    const target = e.target;
    void __privateMethod(this, _UmbDocumentTypeFieldVisibilityEditorElement_instances, setVisibility_fn).call(this, property4.alias, target.checked === true, property4.name);
  }}
          label="Hide"
        ></uui-toggle>
      </div>
    `;
};
UmbDocumentTypeFieldVisibilityEditorElement.styles = [
  UmbTextStyles,
  UmbFieldVisibilityRowStyles,
  css2`
      :host {
        display: block;
      }

      uui-box uui-box {
        --uui-box-default-padding: 0 var(--uui-size-space-5);
        margin-top: var(--uui-size-layout-1);
      }
    `
];
__decorateClass([
  property({ type: String, attribute: "document-type-unique" })
], UmbDocumentTypeFieldVisibilityEditorElement.prototype, "documentTypeUnique", 2);
__decorateClass([
  property({ type: Boolean, attribute: "embedded" })
], UmbDocumentTypeFieldVisibilityEditorElement.prototype, "embedded", 2);
__decorateClass([
  state()
], UmbDocumentTypeFieldVisibilityEditorElement.prototype, "_layout", 2);
__decorateClass([
  state()
], UmbDocumentTypeFieldVisibilityEditorElement.prototype, "_activeTabKey", 2);
__decorateClass([
  state()
], UmbDocumentTypeFieldVisibilityEditorElement.prototype, "_fieldVisibility", 2);
__decorateClass([
  state()
], UmbDocumentTypeFieldVisibilityEditorElement.prototype, "_loading", 2);
__decorateClass([
  state()
], UmbDocumentTypeFieldVisibilityEditorElement.prototype, "_error", 2);
__decorateClass([
  state()
], UmbDocumentTypeFieldVisibilityEditorElement.prototype, "_saving", 2);
UmbDocumentTypeFieldVisibilityEditorElement = __decorateClass([
  customElement("umb-document-type-field-visibility-editor")
], UmbDocumentTypeFieldVisibilityEditorElement);

// src/utils/load-all-block-list-data-type-options.ts
import {
  DataTypeService
} from "@umbraco-cms/backoffice/external/backend-api";
import { tryExecute } from "@umbraco-cms/backoffice/resources";
var BLOCK_LIST_EDITOR_UI = "Umb.PropertyEditorUi.BlockList";
var TREE_PAGE_SIZE = 100;
async function loadTreePage(host, parentId, skip) {
  if (parentId === void 0) {
    const { data: data2 } = await tryExecute(
      host,
      DataTypeService.getTreeDataTypeRoot({
        query: { skip, take: TREE_PAGE_SIZE, foldersOnly: false }
      })
    );
    return data2 ? { items: data2.items, total: data2.total } : void 0;
  }
  const { data } = await tryExecute(
    host,
    DataTypeService.getTreeDataTypeChildren({
      query: { parentId, skip, take: TREE_PAGE_SIZE, foldersOnly: false }
    })
  );
  return data ? { items: data.items, total: data.total } : void 0;
}
async function loadAllTreeItems(host, parentId) {
  const items = [];
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
async function loadAllBlockListDataTypeOptions(host) {
  const options = [];
  async function walk(parentId) {
    const items = await loadAllTreeItems(host, parentId);
    for (const item of items) {
      if (item.isFolder) {
        await walk(item.id);
        continue;
      }
      if (item.editorUiAlias === BLOCK_LIST_EDITOR_UI && item.id) {
        options.push({
          unique: item.id,
          name: item.name
        });
      }
    }
  }
  await walk(void 0);
  return options.sort((a, b) => a.name.localeCompare(b.name));
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

// src/utils/load-all-unique-block-type-options.ts
import { UmbDataTypeDetailRepository } from "@umbraco-cms/backoffice/data-type";
import {
  UmbDocumentTypeDetailRepository as UmbDocumentTypeDetailRepository2,
  UmbDocumentTypeItemRepository
} from "@umbraco-cms/backoffice/document-type";
var BLOCK_LIST_EDITOR_UI2 = "Umb.PropertyEditorUi.BlockList";
function mergeVisibility(target, source) {
  if (!source) {
    return;
  }
  for (const [alias, hide] of Object.entries(source)) {
    if (hide === true) {
      target[alias] = true;
    }
  }
}
var ELEMENT_TYPE_BATCH_SIZE = 20;
async function loadNestedBlockListRefs(host, blockListDataTypeIds, elementTypeKeys) {
  const refs = [];
  const documentTypeRepository = new UmbDocumentTypeDetailRepository2(host);
  const dataTypeRepository = new UmbDataTypeDetailRepository(host);
  const keys = [...elementTypeKeys];
  for (let index = 0; index < keys.length; index += ELEMENT_TYPE_BATCH_SIZE) {
    const batch = keys.slice(index, index + ELEMENT_TYPE_BATCH_SIZE);
    const { data: elementTypes } = await documentTypeRepository.requestByUniques(batch);
    for (const elementType of elementTypes ?? []) {
      if (!elementType.properties?.length) {
        continue;
      }
      for (const property4 of elementType.properties) {
        const dataTypeUnique = property4.dataType?.unique;
        if (!dataTypeUnique || !blockListDataTypeIds.has(dataTypeUnique)) {
          continue;
        }
        const { data: dataType, error } = await dataTypeRepository.requestByUnique(dataTypeUnique);
        if (error || dataType?.editorUiAlias !== BLOCK_LIST_EDITOR_UI2) {
          continue;
        }
        refs.push({
          parentContentElementTypeKey: elementType.unique,
          parentPropertyAlias: property4.alias,
          blockListDataTypeUnique: dataTypeUnique
        });
      }
    }
  }
  return refs;
}
function getPlacementScopeValue(placement) {
  return `${placement.blockListDataTypeUnique}|${placement.parentContentElementTypeKey ?? ""}|${placement.parentPropertyAlias ?? ""}`;
}
function placementKey(placement) {
  return getPlacementScopeValue(placement);
}
function isNestedBlockListPlacement(placement) {
  return !!placement.parentContentElementTypeKey;
}
function getNestedPlacements(option) {
  return option.placements.filter(isNestedBlockListPlacement);
}
function parseBlockListDataTypeFromScope(scope) {
  if (!scope) {
    return void 0;
  }
  const id = scope.split("|")[0];
  return id || void 0;
}
async function loadAllUniqueBlockTypeOptions(host) {
  const blockListDataTypes = await loadAllBlockListDataTypeOptions(host);
  const dataTypeRepository = new UmbDataTypeDetailRepository(host);
  const blockListNameById = new Map(blockListDataTypes.map((item) => [item.unique, item.name]));
  const blockListIds = new Set(blockListDataTypes.map((item) => item.unique));
  const byContentKey = /* @__PURE__ */ new Map();
  const elementTypeKeys = /* @__PURE__ */ new Set();
  for (const dataTypeOption of blockListDataTypes) {
    const { data } = await dataTypeRepository.requestByUnique(dataTypeOption.unique);
    if (!data) {
      continue;
    }
    for (const block of getBlocksFromDataType(data)) {
      const key = block.contentElementTypeKey;
      if (!key) {
        continue;
      }
      elementTypeKeys.add(key);
      const placement = {
        blockListDataTypeUnique: dataTypeOption.unique,
        blockListDataTypeName: dataTypeOption.name,
        label: `Block list: ${dataTypeOption.name}`,
        fieldVisibility: { ...block.fieldVisibility ?? {} },
        settingsFieldVisibility: { ...block.settingsFieldVisibility ?? {} }
      };
      let option = byContentKey.get(key);
      if (!option) {
        option = {
          contentElementTypeKey: key,
          name: key,
          settingsElementTypeKey: block.settingsElementTypeKey,
          fieldVisibility: { ...block.fieldVisibility ?? {} },
          settingsFieldVisibility: { ...block.settingsFieldVisibility ?? {} },
          placements: [placement]
        };
        byContentKey.set(key, option);
        continue;
      }
      if (!option.settingsElementTypeKey && block.settingsElementTypeKey) {
        option.settingsElementTypeKey = block.settingsElementTypeKey;
      }
      mergeVisibility(option.fieldVisibility, block.fieldVisibility);
      mergeVisibility(option.settingsFieldVisibility, block.settingsFieldVisibility);
      const existingPlacement = option.placements.find((p) => placementKey(p) === placementKey(placement));
      if (existingPlacement) {
        mergeVisibility(existingPlacement.fieldVisibility, block.fieldVisibility);
        mergeVisibility(existingPlacement.settingsFieldVisibility, block.settingsFieldVisibility);
      } else {
        option.placements.push(placement);
      }
    }
  }
  const nestedRefs = await loadNestedBlockListRefs(host, blockListIds, elementTypeKeys);
  const itemRepository = new UmbDocumentTypeItemRepository(host);
  const parentKeys = [...new Set(nestedRefs.map((ref) => ref.parentContentElementTypeKey))];
  const { data: parentItems } = parentKeys.length ? await itemRepository.requestItems(parentKeys) : { data: [] };
  const parentNameByKey = new Map((parentItems ?? []).map((item) => [item.unique, item.name]));
  for (const ref of nestedRefs) {
    const parentName = parentNameByKey.get(ref.parentContentElementTypeKey) ?? ref.parentContentElementTypeKey;
    const blockListName = blockListNameById.get(ref.blockListDataTypeUnique) ?? ref.blockListDataTypeUnique;
    for (const option of byContentKey.values()) {
      const rootPlacement = option.placements.find(
        (p) => p.blockListDataTypeUnique === ref.blockListDataTypeUnique && !p.parentContentElementTypeKey
      );
      if (!rootPlacement) {
        continue;
      }
      const nestedPlacement = {
        blockListDataTypeUnique: ref.blockListDataTypeUnique,
        blockListDataTypeName: blockListName,
        parentContentElementTypeKey: ref.parentContentElementTypeKey,
        parentPropertyAlias: ref.parentPropertyAlias,
        label: `Nested block list: ${parentName} \u203A ${ref.parentPropertyAlias} \u203A ${blockListName}`,
        fieldVisibility: { ...rootPlacement.fieldVisibility },
        settingsFieldVisibility: { ...rootPlacement.settingsFieldVisibility }
      };
      if (option.placements.some((p) => placementKey(p) === placementKey(nestedPlacement))) {
        continue;
      }
      option.placements.push(nestedPlacement);
    }
  }
  const options = [...byContentKey.values()];
  if (!options.length) {
    return [];
  }
  const keys = options.flatMap(
    (option) => [option.contentElementTypeKey, option.settingsElementTypeKey].filter(Boolean)
  );
  const { data: items } = await itemRepository.requestItems(keys);
  const nameByKey = /* @__PURE__ */ new Map();
  (items ?? []).forEach((item) => nameByKey.set(item.unique, item.name));
  return options.map((option) => ({
    ...option,
    name: nameByKey.get(option.contentElementTypeKey) ?? option.contentElementTypeKey,
    placements: [...option.placements].sort((a, b) => a.label.localeCompare(b.label))
  })).sort((a, b) => a.name.localeCompare(b.name));
}
function getBlockVisibilityForScope(option, blockListScope) {
  if (!blockListScope) {
    return {
      fieldVisibility: { ...option.fieldVisibility },
      settingsFieldVisibility: { ...option.settingsFieldVisibility }
    };
  }
  const placement = option.placements.find((p) => getPlacementScopeValue(p) === blockListScope) ?? option.placements.find((p) => p.blockListDataTypeUnique === blockListScope);
  if (!placement) {
    return { fieldVisibility: {}, settingsFieldVisibility: {} };
  }
  return {
    fieldVisibility: { ...placement.fieldVisibility },
    settingsFieldVisibility: { ...placement.settingsFieldVisibility }
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

// src/utils/save-block-type-visibility-all-block-lists.ts
import { UmbDataTypeDetailRepository as UmbDataTypeDetailRepository2 } from "@umbraco-cms/backoffice/data-type";
async function saveBlockTypeVisibilityAcrossAllBlockLists(host, contentElementTypeKey, fieldVisibility, settingsFieldVisibility, blockListDataTypeUnique) {
  const dataTypeRepository = new UmbDataTypeDetailRepository2(host);
  const blockListDataTypes = await loadAllBlockListDataTypeOptions(host);
  let saved = 0;
  let failed = 0;
  for (const option of blockListDataTypes) {
    if (blockListDataTypeUnique && option.unique !== blockListDataTypeUnique) {
      continue;
    }
    const { data } = await dataTypeRepository.requestByUnique(option.unique);
    if (!data) {
      failed += 1;
      continue;
    }
    const blocks = getBlocksFromDataType(data);
    if (!blocks.some((block) => block.contentElementTypeKey === contentElementTypeKey)) {
      continue;
    }
    const nextBlocks = blocks.map((block) => {
      if (block.contentElementTypeKey !== contentElementTypeKey) {
        return block;
      }
      return {
        ...block,
        fieldVisibility: { ...fieldVisibility },
        settingsFieldVisibility: { ...settingsFieldVisibility }
      };
    });
    const toSave = setBlocksOnDataType(data, nextBlocks);
    const { error } = await dataTypeRepository.save(toSave);
    if (error) {
      failed += 1;
    } else {
      saved += 1;
      notifyBlockFieldVisibilityDataTypeUpdated(option.unique, nextBlocks);
    }
  }
  notifyBlockElementTypeVisibilityUpdated(contentElementTypeKey, fieldVisibility, settingsFieldVisibility);
  return { saved, failed };
}

// src/utils/load-element-type-properties.ts
import {
  UmbDocumentTypeDetailRepository as UmbDocumentTypeDetailRepository3
} from "@umbraco-cms/backoffice/document-type";
async function loadDocumentTypesWithCompositions(host, rootUnique) {
  const repository = new UmbDocumentTypeDetailRepository3(host);
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
    for (const property4 of documentType.properties ?? []) {
      if (seenAliases.has(property4.alias)) {
        continue;
      }
      seenAliases.add(property4.alias);
      properties.push({
        alias: property4.alias,
        name: property4.name ?? property4.alias
      });
    }
  }
  return properties;
}

// src/components/block-field-visibility-block-editor.element.ts
import { css as css3, html as html2, nothing as nothing2, property as property2, state as state2 } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement as UmbLitElement2 } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles as UmbTextStyles2 } from "@umbraco-cms/backoffice/style";
var BLOCK_EDITOR_TAG = "umb-block-field-visibility-block-editor";
var UmbBlockFieldVisibilityBlockEditorElement = class extends UmbLitElement2 {
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
    const inner = html2`
      ${this._contentProperties.length ? html2`
            <uui-box headline="Content">
              ${this._contentProperties.map(
      (property4) => this.#renderRow(
        property4,
        this.fieldVisibility,
        (hide) => this.#emitContentChange(property4.alias, hide)
      )
    )}
            </uui-box>
          ` : html2`<p class="uui-text">No content properties found.</p>`}

      ${this.settingsElementTypeKey ? html2`
            ${this._settingsProperties.length ? html2`
                  <uui-box headline="Settings">
                    ${this._settingsProperties.map(
      (property4) => this.#renderRow(
        property4,
        this.settingsFieldVisibility,
        (hide) => this.#emitSettingsChange(property4.alias, hide)
      )
    )}
                  </uui-box>
                ` : html2`<p class="uui-text">No settings properties found.</p>`}
          ` : nothing2}
    `;
    if (this.hideHeadline) {
      return html2`<div class="editor-inner">${inner}</div>`;
    }
    return html2`<uui-box headline=${this.blockName || "Block type"}>${inner}</uui-box>`;
  }
  #renderRow(property4, map, onChange) {
    const hide = map[property4.alias] === true;
    return html2`
      <div class="field-row">
        <div class="field-label">
          <span class="field-name">${property4.name}</span>
          <span class="field-alias">${property4.alias}</span>
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
      UmbTextStyles2,
      UmbFieldVisibilityRowStyles,
      css3`
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
  property2({ type: String, attribute: false })
], UmbBlockFieldVisibilityBlockEditorElement.prototype, "blockName", 2);
__decorateClass([
  property2({ type: String, attribute: false })
], UmbBlockFieldVisibilityBlockEditorElement.prototype, "contentElementTypeKey", 2);
__decorateClass([
  property2({ type: String, attribute: false })
], UmbBlockFieldVisibilityBlockEditorElement.prototype, "settingsElementTypeKey", 2);
__decorateClass([
  property2({ type: Object, attribute: false })
], UmbBlockFieldVisibilityBlockEditorElement.prototype, "fieldVisibility", 2);
__decorateClass([
  property2({ type: Object, attribute: false })
], UmbBlockFieldVisibilityBlockEditorElement.prototype, "settingsFieldVisibility", 2);
__decorateClass([
  property2({ type: Boolean, attribute: "hide-headline" })
], UmbBlockFieldVisibilityBlockEditorElement.prototype, "hideHeadline", 2);
__decorateClass([
  state2()
], UmbBlockFieldVisibilityBlockEditorElement.prototype, "_contentProperties", 2);
__decorateClass([
  state2()
], UmbBlockFieldVisibilityBlockEditorElement.prototype, "_settingsProperties", 2);
if (!customElements.get(BLOCK_EDITOR_TAG)) {
  customElements.define(BLOCK_EDITOR_TAG, UmbBlockFieldVisibilityBlockEditorElement);
}
var block_field_visibility_block_editor_element_default = UmbBlockFieldVisibilityBlockEditorElement;

// src/components/block-type-field-visibility-panel.element.ts
var _saveTimer, _UmbBlockTypeFieldVisibilityPanelElement_instances, onContentChange_fn, onSettingsChange_fn, scheduleSave_fn, save_fn;
import { customElement as customElement2, html as html3, nothing as nothing3, property as property3, state as state3 } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement as UmbLitElement3 } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles as UmbTextStyles3 } from "@umbraco-cms/backoffice/style";
var UmbBlockTypeFieldVisibilityPanelElement = class extends UmbLitElement3 {
  constructor() {
    super(...arguments);
    __privateAdd(this, _UmbBlockTypeFieldVisibilityPanelElement_instances);
    this.contentElementTypeKey = "";
    this.blockName = "";
    this.fieldVisibility = {};
    this.settingsFieldVisibility = {};
    this.blockListScope = "";
    this._fieldVisibility = {};
    this._settingsFieldVisibility = {};
    this._saving = false;
    __privateAdd(this, _saveTimer);
  }
  updated(changed) {
    if (changed.has("contentElementTypeKey") || changed.has("fieldVisibility") || changed.has("settingsFieldVisibility") || changed.has("blockListScope")) {
      this._fieldVisibility = { ...this.fieldVisibility };
      this._settingsFieldVisibility = { ...this.settingsFieldVisibility };
      this._saveMessage = void 0;
    }
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    if (__privateGet(this, _saveTimer)) {
      clearTimeout(__privateGet(this, _saveTimer));
    }
  }
  render() {
    if (!this.contentElementTypeKey) {
      return nothing3;
    }
    return html3`
      <uui-box .headline=${this.blockName || "Block type"}>
        ${this._saving ? html3`<p class="status-text">Saving…</p>` : nothing3}
        ${this._saveMessage ? html3`<p class="status-text">${this._saveMessage}</p>` : nothing3}
        ${this._error ? html3`<p class="error-text">${this._error}</p>` : nothing3}

        <umb-block-field-visibility-block-editor
          hide-headline
          .blockName=${this.blockName}
          .contentElementTypeKey=${this.contentElementTypeKey}
          .settingsElementTypeKey=${this.settingsElementTypeKey}
          .fieldVisibility=${this._fieldVisibility}
          .settingsFieldVisibility=${this._settingsFieldVisibility}
          @field-visibility-change=${(e) => {
      if (e.detail.target === "settings") {
        __privateMethod(this, _UmbBlockTypeFieldVisibilityPanelElement_instances, onSettingsChange_fn).call(this, e);
      } else {
        __privateMethod(this, _UmbBlockTypeFieldVisibilityPanelElement_instances, onContentChange_fn).call(this, e);
      }
    }}
        ></umb-block-field-visibility-block-editor>
      </uui-box>
    `;
  }
};
_saveTimer = new WeakMap();
_UmbBlockTypeFieldVisibilityPanelElement_instances = new WeakSet();
onContentChange_fn = function(event) {
  const { alias, hide } = event.detail;
  this._fieldVisibility = { ...this._fieldVisibility, [alias]: hide };
  __privateMethod(this, _UmbBlockTypeFieldVisibilityPanelElement_instances, scheduleSave_fn).call(this);
};
onSettingsChange_fn = function(event) {
  const { alias, hide } = event.detail;
  this._settingsFieldVisibility = { ...this._settingsFieldVisibility, [alias]: hide };
  __privateMethod(this, _UmbBlockTypeFieldVisibilityPanelElement_instances, scheduleSave_fn).call(this);
};
scheduleSave_fn = function() {
  if (__privateGet(this, _saveTimer)) {
    clearTimeout(__privateGet(this, _saveTimer));
  }
  __privateSet(this, _saveTimer, setTimeout(() => void __privateMethod(this, _UmbBlockTypeFieldVisibilityPanelElement_instances, save_fn).call(this), 400));
};
save_fn = async function() {
  const key = this.contentElementTypeKey;
  if (!key) {
    return;
  }
  this._saving = true;
  this._error = void 0;
  this._saveMessage = void 0;
  const { saved, failed } = await saveBlockTypeVisibilityAcrossAllBlockLists(
    this,
    key,
    this._fieldVisibility,
    this._settingsFieldVisibility,
    parseBlockListDataTypeFromScope(this.blockListScope)
  );
  this._saving = false;
  if (!saved && failed) {
    this._error = "Could not save. You may need permission to edit data types.";
    await notifyFieldVisibilityBatchSaved(this, this._error, "danger");
    return;
  }
  this._saveMessage = saved > 0 ? `Saved to ${saved} Block List data type${saved === 1 ? "" : "s"}. Open or refresh the page, then expand the block to apply hides.` : "This block type is not used on any Block List data type yet.";
  await notifyFieldVisibilityBatchSaved(
    this,
    this._saveMessage,
    saved > 0 ? "positive" : "warning"
  );
};
UmbBlockTypeFieldVisibilityPanelElement.styles = [UmbTextStyles3, UmbFieldVisibilityRowStyles];
__decorateClass([
  property3({ type: String, attribute: "content-element-type-key" })
], UmbBlockTypeFieldVisibilityPanelElement.prototype, "contentElementTypeKey", 2);
__decorateClass([
  property3({ type: String, attribute: false })
], UmbBlockTypeFieldVisibilityPanelElement.prototype, "blockName", 2);
__decorateClass([
  property3({ type: String, attribute: false })
], UmbBlockTypeFieldVisibilityPanelElement.prototype, "settingsElementTypeKey", 2);
__decorateClass([
  property3({ type: Object, attribute: false })
], UmbBlockTypeFieldVisibilityPanelElement.prototype, "fieldVisibility", 2);
__decorateClass([
  property3({ type: Object, attribute: false })
], UmbBlockTypeFieldVisibilityPanelElement.prototype, "settingsFieldVisibility", 2);
__decorateClass([
  property3({ type: String, attribute: "block-list-scope" })
], UmbBlockTypeFieldVisibilityPanelElement.prototype, "blockListScope", 2);
__decorateClass([
  state3()
], UmbBlockTypeFieldVisibilityPanelElement.prototype, "_fieldVisibility", 2);
__decorateClass([
  state3()
], UmbBlockTypeFieldVisibilityPanelElement.prototype, "_settingsFieldVisibility", 2);
__decorateClass([
  state3()
], UmbBlockTypeFieldVisibilityPanelElement.prototype, "_saving", 2);
__decorateClass([
  state3()
], UmbBlockTypeFieldVisibilityPanelElement.prototype, "_error", 2);
__decorateClass([
  state3()
], UmbBlockTypeFieldVisibilityPanelElement.prototype, "_saveMessage", 2);
UmbBlockTypeFieldVisibilityPanelElement = __decorateClass([
  customElement2("umb-block-type-field-visibility-panel")
], UmbBlockTypeFieldVisibilityPanelElement);

// src/utils/load-field-visibility-page-type-options.ts
import {
  DocumentTypeService
} from "@umbraco-cms/backoffice/external/backend-api";
import { tryExecute as tryExecute2 } from "@umbraco-cms/backoffice/resources";
import {
  UmbDocumentTypeItemRepository as UmbDocumentTypeItemRepository2,
  UmbDocumentTypeStructureRepository
} from "@umbraco-cms/backoffice/document-type";
var TREE_PAGE_SIZE2 = 100;
var PARENT_CHUNK_SIZE = 12;
async function loadTreePage2(host, parentId, skip) {
  if (parentId === void 0) {
    const { data: data2 } = await tryExecute2(
      host,
      DocumentTypeService.getTreeDocumentTypeRoot({
        query: { skip, take: TREE_PAGE_SIZE2, foldersOnly: false }
      })
    );
    return data2 ? { items: data2.items, total: data2.total } : void 0;
  }
  const { data } = await tryExecute2(
    host,
    DocumentTypeService.getTreeDocumentTypeChildren({
      query: { parentId, skip, take: TREE_PAGE_SIZE2, foldersOnly: false }
    })
  );
  return data ? { items: data.items, total: data.total } : void 0;
}
async function loadAllItemsForParent(host, parentId) {
  const items = [];
  let skip = 0;
  while (true) {
    const page = await loadTreePage2(host, parentId, skip);
    if (!page?.items.length) {
      break;
    }
    items.push(...page.items);
    if (items.length >= page.total || page.items.length < TREE_PAGE_SIZE2) {
      break;
    }
    skip += TREE_PAGE_SIZE2;
  }
  return items;
}
async function loadAllDocumentTypeUniques(host) {
  const ids = [];
  async function walk(parentId) {
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
  await walk(void 0);
  return ids;
}
async function loadFieldVisibilityPageTypeOptions(host) {
  const structureRepository = new UmbDocumentTypeStructureRepository(host);
  const itemRepository = new UmbDocumentTypeItemRepository2(host);
  const uniques = /* @__PURE__ */ new Set();
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
          null
        );
        for (const child of childrenData?.items ?? []) {
          uniques.add(child.unique);
        }
      })
    );
  }
  const uniqueList = [...uniques];
  if (!uniqueList.length) {
    return [];
  }
  const { data: items } = await itemRepository.requestItems(uniqueList);
  const nameByUnique = new Map((items ?? []).map((item) => [item.unique, item.name]));
  return uniqueList.map((unique) => ({
    unique,
    name: nameByUnique.get(unique) ?? unique
  })).sort((a, b) => a.name.localeCompare(b.name));
}

// src/utils/load-field-visibility-tags.ts
function countHiddenFieldRules(map) {
  if (!map) {
    return 0;
  }
  return Object.values(map).filter((hide) => hide === true).length;
}
function upsertPageFieldVisibilityTag(tags, pageTypes, contentTypeUnique, fieldVisibility) {
  const pageType = pageTypes.find((item) => item.unique === contentTypeUnique);
  if (!pageType) {
    return tags;
  }
  const hiddenCount = countHiddenFieldRules(fieldVisibility);
  const without = tags.filter((tag) => !(tag.kind === "page" && tag.id === contentTypeUnique));
  if (hiddenCount <= 0) {
    return without.sort((a, b) => a.label.localeCompare(b.label));
  }
  return [
    ...without,
    {
      kind: "page",
      id: contentTypeUnique,
      label: pageType.name,
      hiddenCount
    }
  ].sort((a, b) => a.label.localeCompare(b.label));
}
async function loadPageFieldVisibilityTags(host, pageTypes) {
  const tags = [];
  const pageResults = await Promise.all(
    pageTypes.map(async (pageType) => {
      const visibility = await loadFieldVisibilityFromServer(host, pageType.unique);
      const hiddenCount = countHiddenFieldRules(visibility);
      return hiddenCount > 0 ? {
        kind: "page",
        id: pageType.unique,
        label: pageType.name,
        hiddenCount
      } : void 0;
    })
  );
  tags.push(...pageResults.filter((tag) => !!tag));
  return tags.sort((a, b) => a.label.localeCompare(b.label));
}
function loadBlockFieldVisibilityTags(blockTypes) {
  const tags = [];
  for (const block of blockTypes) {
    let addedFromPlacements = false;
    for (const placement of block.placements) {
      const hiddenCount2 = countHiddenFieldRules(placement.fieldVisibility) + countHiddenFieldRules(placement.settingsFieldVisibility);
      if (hiddenCount2 <= 0) {
        continue;
      }
      addedFromPlacements = true;
      const contextLabel = isNestedBlockListPlacement(placement) ? placement.label.replace(/^Nested block list:\s*/i, "") : placement.blockListDataTypeName;
      tags.push({
        kind: "block",
        id: block.contentElementTypeKey,
        label: `${block.name} \xB7 ${contextLabel}`,
        hiddenCount: hiddenCount2,
        scopeValue: isNestedBlockListPlacement(placement) ? getPlacementScopeValue(placement) : void 0
      });
    }
    if (addedFromPlacements) {
      continue;
    }
    const hiddenCount = countHiddenFieldRules(block.fieldVisibility) + countHiddenFieldRules(block.settingsFieldVisibility);
    if (hiddenCount > 0) {
      tags.push({
        kind: "block",
        id: block.contentElementTypeKey,
        label: block.name,
        hiddenCount
      });
    }
  }
  return tags.sort((a, b) => a.label.localeCompare(b.label));
}

// src/utils/load-nested-block-list-context-options.ts
import { UmbDataTypeDetailRepository as UmbDataTypeDetailRepository3 } from "@umbraco-cms/backoffice/data-type";
import {
  UmbDocumentTypeDetailRepository as UmbDocumentTypeDetailRepository4,
  UmbDocumentTypeItemRepository as UmbDocumentTypeItemRepository3
} from "@umbraco-cms/backoffice/document-type";
var BLOCK_LIST_EDITOR_UI3 = "Umb.PropertyEditorUi.BlockList";
var NESTED_CONTEXT_SELF = "__self__";
var VALUE_SEP = "::";
function scopeForNestedList(blockListDataTypeUnique, parentContentElementTypeKey, parentPropertyAlias) {
  const placement = {
    blockListDataTypeUnique,
    blockListDataTypeName: "",
    parentContentElementTypeKey,
    parentPropertyAlias,
    label: "",
    fieldVisibility: {},
    settingsFieldVisibility: {}
  };
  return getPlacementScopeValue(placement);
}
async function loadNestedBlockListContextOptions(host, parentContentElementTypeKey, parentDisplayName) {
  const documentTypeRepository = new UmbDocumentTypeDetailRepository4(host);
  const dataTypeRepository = new UmbDataTypeDetailRepository3(host);
  const itemRepository = new UmbDocumentTypeItemRepository3(host);
  const { data: parentType } = await documentTypeRepository.requestByUnique(parentContentElementTypeKey);
  if (!parentType?.properties?.length) {
    return [];
  }
  const options = [
    {
      name: `${parentDisplayName} (this block)`,
      value: NESTED_CONTEXT_SELF
    }
  ];
  const childKeys = [];
  for (const property4 of parentType.properties) {
    const dataTypeUnique = property4.dataType?.unique;
    if (!dataTypeUnique) {
      continue;
    }
    const { data: dataType, error } = await dataTypeRepository.requestByUnique(dataTypeUnique);
    if (error || dataType?.editorUiAlias !== BLOCK_LIST_EDITOR_UI3) {
      continue;
    }
    const scope = scopeForNestedList(dataTypeUnique, parentContentElementTypeKey, property4.alias);
    const blocks = getBlocksFromDataType(dataType);
    for (const block of blocks) {
      const key = block.contentElementTypeKey;
      if (!key) {
        continue;
      }
      childKeys.push(key);
      options.push({
        name: `${property4.name || property4.alias} \u203A \u2026`,
        value: `${key}${VALUE_SEP}${scope}`
      });
    }
  }
  if (childKeys.length) {
    const { data: items } = await itemRepository.requestItems([...new Set(childKeys)]);
    const nameByKey = new Map((items ?? []).map((item) => [item.unique, item.name]));
    for (const option of options) {
      if (option.value === NESTED_CONTEXT_SELF) {
        continue;
      }
      const sep = option.value.indexOf(VALUE_SEP);
      const childKey = option.value.slice(0, sep);
      const scope = option.value.slice(sep + VALUE_SEP.length);
      const childName = nameByKey.get(childKey) ?? childKey;
      const prefix = option.name.split(" \u203A ")[0];
      option.name = `${prefix} \u203A ${childName}`;
      option.value = `${childKey}${VALUE_SEP}${scope}`;
    }
  }
  return options.length > 1 ? options : [];
}
function parseNestedContextValue(value) {
  if (!value || value === NESTED_CONTEXT_SELF) {
    return { blockListScope: "" };
  }
  const separator = value.indexOf(VALUE_SEP);
  if (separator === -1) {
    return { blockListScope: value };
  }
  return {
    contentElementTypeKey: value.slice(0, separator),
    blockListScope: value.slice(separator + VALUE_SEP.length)
  };
}

// src/views/content-field-visibility-dashboard.element.ts
var _onBlockVisibilityChanged, _UmbContentFieldVisibilityDashboardElement_instances, patchBlockTypesFromSave_fn, _onPageVisibilityChanged, loadOptions_fn, reloadBlockTypesAndTags_fn, loadPageTags_fn, loadBlockTags_fn, loadTags_fn, pageTypeOptions_fn, selectedBlockType_fn, selectedBlockVisibility_fn, blockTypeOptions_fn, nestedContextSelectOptions_fn, refreshNestedContextOptions_fn, applyNestedContext_fn, onPageTypeChange_fn, onBlockTypeChange_fn, onNestedContextChange_fn, onTagClick_fn, scrollTo_fn;
import { css as css5, customElement as customElement3, html as html4, nothing as nothing4, repeat as repeat2, state as state4 } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement as UmbLitElement4 } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles as UmbTextStyles4 } from "@umbraco-cms/backoffice/style";
var PAGE_TYPE_PLACEHOLDER = "";
var BLOCK_TYPE_PLACEHOLDER = "";
var BLOCK_SCOPE_ALL = "";
var UmbContentFieldVisibilityDashboardElement = class extends UmbLitElement4 {
  constructor() {
    super(...arguments);
    __privateAdd(this, _UmbContentFieldVisibilityDashboardElement_instances);
    this._pageTypes = [];
    this._blockTypes = [];
    this._pageTags = [];
    this._blockTags = [];
    this._pageTypeUnique = PAGE_TYPE_PLACEHOLDER;
    this._blockTypeKey = BLOCK_TYPE_PLACEHOLDER;
    this._blockListScope = BLOCK_SCOPE_ALL;
    this._activeBlockConfigKey = BLOCK_TYPE_PLACEHOLDER;
    this._nestedContextOptions = [];
    this._nestedContextValue = NESTED_CONTEXT_SELF;
    this._loadingPageTypes = true;
    this._loadingBlockTypes = true;
    this._loadingTags = false;
    __privateAdd(this, _onBlockVisibilityChanged, (event) => {
      const detail = event.detail;
      if (detail?.contentElementTypeKey) {
        this._blockTypes = __privateMethod(this, _UmbContentFieldVisibilityDashboardElement_instances, patchBlockTypesFromSave_fn).call(this, detail);
        this._blockTags = loadBlockFieldVisibilityTags(this._blockTypes);
      }
      void __privateMethod(this, _UmbContentFieldVisibilityDashboardElement_instances, reloadBlockTypesAndTags_fn).call(this);
    });
    __privateAdd(this, _onPageVisibilityChanged, (event) => {
      const detail = event.detail;
      if (detail?.contentTypeUnique && detail.fieldVisibility) {
        this._pageTags = upsertPageFieldVisibilityTag(
          this._pageTags,
          this._pageTypes,
          detail.contentTypeUnique,
          detail.fieldVisibility
        );
        return;
      }
      void __privateMethod(this, _UmbContentFieldVisibilityDashboardElement_instances, loadPageTags_fn).call(this);
    });
  }
  connectedCallback() {
    super.connectedCallback();
    void __privateMethod(this, _UmbContentFieldVisibilityDashboardElement_instances, loadOptions_fn).call(this);
    window.addEventListener(BLOCK_ELEMENT_TYPE_VISIBILITY_UPDATED, __privateGet(this, _onBlockVisibilityChanged));
    window.addEventListener(DOCUMENT_TYPE_FIELD_VISIBILITY_UPDATED, __privateGet(this, _onPageVisibilityChanged));
  }
  disconnectedCallback() {
    window.removeEventListener(BLOCK_ELEMENT_TYPE_VISIBILITY_UPDATED, __privateGet(this, _onBlockVisibilityChanged));
    window.removeEventListener(DOCUMENT_TYPE_FIELD_VISIBILITY_UPDATED, __privateGet(this, _onPageVisibilityChanged));
    super.disconnectedCallback();
  }
  render() {
    const selectedBlock = __privateMethod(this, _UmbContentFieldVisibilityDashboardElement_instances, selectedBlockType_fn).call(this);
    const blockVisibility = __privateMethod(this, _UmbContentFieldVisibilityDashboardElement_instances, selectedBlockVisibility_fn).call(this);
    const hasPageType = !!this._pageTypeUnique;
    const loading = this._loadingPageTypes || this._loadingBlockTypes;
    const nestedContextOptions = __privateMethod(this, _UmbContentFieldVisibilityDashboardElement_instances, nestedContextSelectOptions_fn).call(this);
    const showNestedContextDropdown = nestedContextOptions.length > 0;
    const nestedScopeActive = !!this._blockListScope && this._blockListScope !== BLOCK_SCOPE_ALL;
    return html4`
      <div id="dashboard">
        <p class="intro uui-text">
          Use <strong>Page type</strong> for document fields. Use <strong>Block type</strong> for fields inside blocks.
          When a block has a nested Block List, use the second dropdown to choose items in that list.
        </p>

          ${this._error ? html4`<p class="error">${this._error}</p>` : nothing4}
          ${loading ? html4`<uui-loader></uui-loader>` : nothing4}

          ${!loading ? html4`
                <uui-box headline="Page properties">
                  ${!this._loadingTags && this._pageTags.length ? html4`
                        <div class="tag-section">
                          <span class="tag-section-label uui-label">Page types with hide rules</span>
                          <div class="tags">
                            ${repeat2(
      this._pageTags,
      (tag) => `page-${tag.id}`,
      (tag) => html4`
                                <button type="button" class="tag-button" @click=${() => __privateMethod(this, _UmbContentFieldVisibilityDashboardElement_instances, onTagClick_fn).call(this, tag)}>
                                  <uui-tag look="default">${tag.label} (${tag.hiddenCount})</uui-tag>
                                </button>
                              `
    )}
                          </div>
                        </div>
                      ` : nothing4}

                  <div class="field">
                    <uui-select
                      id="page-type-select"
                      label="Page type"
                      .options=${__privateMethod(this, _UmbContentFieldVisibilityDashboardElement_instances, pageTypeOptions_fn).call(this)}
                      @change=${__privateMethod(this, _UmbContentFieldVisibilityDashboardElement_instances, onPageTypeChange_fn)}
                    ></uui-select>
                  </div>

                  ${!this._pageTypes.length ? html4`<p class="hint">No eligible page types were found.</p>` : !hasPageType ? html4`<p class="hint">Choose a page type to configure its properties.</p>` : html4`
                          <umb-document-type-field-visibility-editor
                            embedded
                            document-type-unique=${this._pageTypeUnique}
                          ></umb-document-type-field-visibility-editor>
                        `}
                </uui-box>

                <uui-box headline="Block properties">
                  ${this._loadingTags ? html4`<uui-loader></uui-loader>` : nothing4}
                  ${!this._loadingTags && this._blockTags.length ? html4`
                        <div class="tag-section">
                          <span class="tag-section-label uui-label">Block lists with hide rules</span>
                          <div class="tags">
                            ${repeat2(
      this._blockTags,
      (tag) => `${tag.id}-${tag.scopeValue ?? ""}-${tag.label}`,
      (tag) => html4`
                                <button type="button" class="tag-button" @click=${() => __privateMethod(this, _UmbContentFieldVisibilityDashboardElement_instances, onTagClick_fn).call(this, tag)}>
                                  <uui-tag look="default">${tag.label} (${tag.hiddenCount})</uui-tag>
                                </button>
                              `
    )}
                          </div>
                        </div>
                      ` : nothing4}

                  <div class="field">
                    <uui-select
                      id="block-type-select"
                      label="Block type"
                      .options=${__privateMethod(this, _UmbContentFieldVisibilityDashboardElement_instances, blockTypeOptions_fn).call(this)}
                      @change=${__privateMethod(this, _UmbContentFieldVisibilityDashboardElement_instances, onBlockTypeChange_fn)}
                    ></uui-select>
                  </div>

                  ${showNestedContextDropdown ? html4`
                        <div class="field">
                          <uui-select
                            id="block-nested-context-select"
                            label=${this._nestedContextOptions.length ? "Nested block items" : "Nested block list"}
                            .options=${nestedContextOptions}
                            @change=${__privateMethod(this, _UmbContentFieldVisibilityDashboardElement_instances, onNestedContextChange_fn)}
                          ></uui-select>
                          <p class="hint scope-hint">
                            ${this._nestedContextOptions.length ? "Choose this block or an item block inside its nested Block List." : "This block type can appear inside another block\u2019s nested Block List."}
                          </p>
                        </div>
                      ` : nothing4}

                  ${!this._blockTypes.length ? html4`<p class="hint">No block types were found on any Block List data type.</p>` : !selectedBlock ? html4`<p class="hint">Choose a block type to configure its fields.</p>` : html4`
                          <umb-block-type-field-visibility-panel
                            content-element-type-key=${selectedBlock.contentElementTypeKey}
                            block-list-scope=${nestedScopeActive ? this._blockListScope : ""}
                            .blockName=${selectedBlock.name}
                            .settingsElementTypeKey=${selectedBlock.settingsElementTypeKey}
                            .fieldVisibility=${blockVisibility.fieldVisibility}
                            .settingsFieldVisibility=${blockVisibility.settingsFieldVisibility}
                          ></umb-block-type-field-visibility-panel>
                          <p class="hint">
                            After saving, refresh the page or collapse and expand the block so the editor picks up
                            changes.
                          </p>
                        `}
                </uui-box>
              ` : nothing4}
      </div>
    `;
  }
};
_onBlockVisibilityChanged = new WeakMap();
_UmbContentFieldVisibilityDashboardElement_instances = new WeakSet();
patchBlockTypesFromSave_fn = function(detail) {
  const fieldVisibility = { ...detail.fieldVisibility };
  const settingsFieldVisibility = { ...detail.settingsFieldVisibility };
  return this._blockTypes.map((option) => {
    if (option.contentElementTypeKey !== detail.contentElementTypeKey) {
      return option;
    }
    const scope = this._blockListScope;
    const dataTypeId = scope ? scope.split("|")[0] : void 0;
    const placements = option.placements.map((placement) => {
      if (dataTypeId && placement.blockListDataTypeUnique !== dataTypeId) {
        return placement;
      }
      return {
        ...placement,
        fieldVisibility: { ...fieldVisibility },
        settingsFieldVisibility: { ...settingsFieldVisibility }
      };
    });
    return {
      ...option,
      fieldVisibility: dataTypeId ? option.fieldVisibility : fieldVisibility,
      settingsFieldVisibility: dataTypeId ? option.settingsFieldVisibility : settingsFieldVisibility,
      placements
    };
  });
};
_onPageVisibilityChanged = new WeakMap();
loadOptions_fn = async function() {
  this._loadingPageTypes = true;
  this._loadingBlockTypes = true;
  this._error = void 0;
  try {
    const [pageTypes, blockTypes] = await Promise.all([
      loadFieldVisibilityPageTypeOptions(this),
      loadAllUniqueBlockTypeOptions(this)
    ]);
    this._pageTypes = pageTypes;
    this._blockTypes = blockTypes;
    void __privateMethod(this, _UmbContentFieldVisibilityDashboardElement_instances, loadTags_fn).call(this);
  } catch {
    this._error = "Could not load page types or block types.";
    this._pageTypes = [];
    this._blockTypes = [];
    this._pageTags = [];
    this._blockTags = [];
  }
  this._loadingPageTypes = false;
  this._loadingBlockTypes = false;
};
reloadBlockTypesAndTags_fn = async function() {
  try {
    this._blockTypes = await loadAllUniqueBlockTypeOptions(this);
    this._blockTags = loadBlockFieldVisibilityTags(this._blockTypes);
  } catch {
    this._blockTags = [];
  }
};
loadPageTags_fn = async function() {
  this._loadingTags = true;
  try {
    this._pageTags = await loadPageFieldVisibilityTags(this, this._pageTypes);
  } catch {
    this._pageTags = [];
  }
  this._loadingTags = false;
};
loadBlockTags_fn = async function() {
  this._blockTags = loadBlockFieldVisibilityTags(this._blockTypes);
};
loadTags_fn = async function() {
  await Promise.all([__privateMethod(this, _UmbContentFieldVisibilityDashboardElement_instances, loadPageTags_fn).call(this), __privateMethod(this, _UmbContentFieldVisibilityDashboardElement_instances, loadBlockTags_fn).call(this)]);
};
pageTypeOptions_fn = function() {
  const options = [
    {
      name: "Choose page type\u2026",
      value: PAGE_TYPE_PLACEHOLDER,
      selected: this._pageTypeUnique === PAGE_TYPE_PLACEHOLDER
    }
  ];
  for (const item of this._pageTypes) {
    options.push({
      name: item.name,
      value: item.unique,
      selected: item.unique === this._pageTypeUnique
    });
  }
  return options;
};
selectedBlockType_fn = function() {
  const key = this._activeBlockConfigKey || this._blockTypeKey;
  if (!key) {
    return void 0;
  }
  return this._blockTypes.find((item) => item.contentElementTypeKey === key);
};
selectedBlockVisibility_fn = function() {
  const block = __privateMethod(this, _UmbContentFieldVisibilityDashboardElement_instances, selectedBlockType_fn).call(this);
  if (!block) {
    return { fieldVisibility: {}, settingsFieldVisibility: {} };
  }
  const nested = getNestedPlacements(block);
  if (nested.length && this._blockListScope && this._blockListScope !== BLOCK_SCOPE_ALL) {
    return getBlockVisibilityForScope(block, this._blockListScope);
  }
  return getBlockVisibilityForScope(block, BLOCK_SCOPE_ALL);
};
blockTypeOptions_fn = function() {
  const options = [
    {
      name: "Choose block type\u2026",
      value: BLOCK_TYPE_PLACEHOLDER,
      selected: this._blockTypeKey === BLOCK_TYPE_PLACEHOLDER
    }
  ];
  for (const item of this._blockTypes) {
    options.push({
      name: item.name,
      value: item.contentElementTypeKey,
      selected: item.contentElementTypeKey === this._blockTypeKey
    });
  }
  return options;
};
/** Nested items inside the selected block (e.g. Hero › Hero item), or nested placement contexts. */
nestedContextSelectOptions_fn = function() {
  if (this._nestedContextOptions.length) {
    return this._nestedContextOptions.map((option) => ({
      name: option.name,
      value: option.value,
      selected: option.value === this._nestedContextValue
    }));
  }
  const selected = this._blockTypes.find((item) => item.contentElementTypeKey === this._blockTypeKey);
  if (!selected) {
    return [];
  }
  return getNestedPlacements(selected).map((placement) => ({
    name: placement.label.replace(/^Nested block list:\s*/i, ""),
    value: getPlacementScopeValue(placement),
    selected: this._blockListScope === getPlacementScopeValue(placement)
  }));
};
refreshNestedContextOptions_fn = async function(block) {
  if (!block) {
    this._nestedContextOptions = [];
    this._nestedContextValue = NESTED_CONTEXT_SELF;
    return;
  }
  const parentOptions = await loadNestedBlockListContextOptions(this, block.contentElementTypeKey, block.name);
  this._nestedContextOptions = parentOptions;
  if (parentOptions.length) {
    this._nestedContextValue = NESTED_CONTEXT_SELF;
    this._activeBlockConfigKey = block.contentElementTypeKey;
    this._blockListScope = BLOCK_SCOPE_ALL;
    return;
  }
  this._nestedContextValue = this._blockListScope || NESTED_CONTEXT_SELF;
};
applyNestedContext_fn = function(value) {
  this._nestedContextValue = value;
  if (this._nestedContextOptions.length) {
    const parsed = parseNestedContextValue(value);
    const parent = this._blockTypes.find((item) => item.contentElementTypeKey === this._blockTypeKey);
    if (!parent) {
      return;
    }
    if (!parsed.contentElementTypeKey) {
      this._activeBlockConfigKey = parent.contentElementTypeKey;
      this._blockListScope = BLOCK_SCOPE_ALL;
      return;
    }
    this._activeBlockConfigKey = parsed.contentElementTypeKey;
    this._blockListScope = parsed.blockListScope;
    return;
  }
  this._activeBlockConfigKey = this._blockTypeKey;
  this._blockListScope = value === NESTED_CONTEXT_SELF ? BLOCK_SCOPE_ALL : value;
};
onPageTypeChange_fn = function(event) {
  const target = event.target;
  this._pageTypeUnique = target.value ?? PAGE_TYPE_PLACEHOLDER;
};
onBlockTypeChange_fn = function(event) {
  const target = event.target;
  this._blockTypeKey = target.value ?? BLOCK_TYPE_PLACEHOLDER;
  this._activeBlockConfigKey = this._blockTypeKey;
  this._blockListScope = BLOCK_SCOPE_ALL;
  this._nestedContextValue = NESTED_CONTEXT_SELF;
  const block = this._blockTypes.find((item) => item.contentElementTypeKey === this._blockTypeKey);
  void __privateMethod(this, _UmbContentFieldVisibilityDashboardElement_instances, refreshNestedContextOptions_fn).call(this, block);
};
onNestedContextChange_fn = function(event) {
  const target = event.target;
  __privateMethod(this, _UmbContentFieldVisibilityDashboardElement_instances, applyNestedContext_fn).call(this, target.value ?? NESTED_CONTEXT_SELF);
};
onTagClick_fn = function(tag) {
  if (tag.kind === "page") {
    this._pageTypeUnique = tag.id;
    __privateMethod(this, _UmbContentFieldVisibilityDashboardElement_instances, scrollTo_fn).call(this, "page-type-select");
    return;
  }
  this._blockTypeKey = tag.id;
  this._activeBlockConfigKey = tag.id;
  this._blockListScope = tag.scopeValue ?? BLOCK_SCOPE_ALL;
  const block = this._blockTypes.find((item) => item.contentElementTypeKey === tag.id);
  void __privateMethod(this, _UmbContentFieldVisibilityDashboardElement_instances, refreshNestedContextOptions_fn).call(this, block).then(() => {
    if (tag.scopeValue) {
      const match = this._nestedContextOptions.find((option) => {
        const parsed = parseNestedContextValue(option.value);
        return parsed.blockListScope === tag.scopeValue && parsed.contentElementTypeKey === tag.id;
      });
      if (match) {
        __privateMethod(this, _UmbContentFieldVisibilityDashboardElement_instances, applyNestedContext_fn).call(this, match.value);
      } else {
        this._nestedContextValue = tag.scopeValue;
      }
    }
  });
  __privateMethod(this, _UmbContentFieldVisibilityDashboardElement_instances, scrollTo_fn).call(this, "block-type-select");
};
scrollTo_fn = function(elementId) {
  requestAnimationFrame(() => {
    this.shadowRoot?.getElementById(elementId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
};
UmbContentFieldVisibilityDashboardElement.styles = [
  UmbTextStyles4,
  css5`
      :host {
        display: block;
        height: 100%;
        padding: var(--uui-size-layout-1);
        padding-bottom: var(--uui-size-layout-2);
        box-sizing: border-box;
        max-width: 62rem;
      }

      #dashboard {
        display: flex;
        flex-direction: column;
        gap: var(--uui-size-layout-1);
      }

      .intro {
        color: var(--uui-color-text-alt);
        margin: 0;
      }

      .error {
        color: var(--uui-color-danger);
        margin: 0;
      }

      .hint {
        color: var(--uui-color-text-alt);
        margin: var(--uui-size-space-3) 0 0;
      }

      .scope-hint {
        margin: var(--uui-size-space-2) 0 0;
      }

      uui-box {
        display: block;
      }

      .field {
        display: flex;
        flex-direction: column;
        gap: var(--uui-size-space-2);
        max-width: min(100%, 28rem);
        margin-bottom: var(--uui-size-space-4);
      }

      uui-select {
        width: 100%;
      }

      .tag-section {
        margin-bottom: var(--uui-size-space-5);
      }

      .tag-section-label {
        display: block;
        margin-bottom: var(--uui-size-space-2);
      }

      .tags {
        display: flex;
        flex-wrap: wrap;
        gap: var(--uui-size-space-2);
      }

      .tag-button {
        border: none;
        background: none;
        padding: 0;
        cursor: pointer;
        font: inherit;
      }

      .tag-button:focus-visible uui-tag {
        outline: 2px solid var(--uui-color-focus);
        outline-offset: 2px;
      }

      umb-document-type-field-visibility-editor,
      umb-block-type-field-visibility-panel {
        display: block;
        margin-top: var(--uui-size-space-5);
      }

      uui-tab-group {
        margin-bottom: var(--uui-size-space-4);
      }

      uui-loader {
        margin: var(--uui-size-space-5) 0;
      }
    `
];
__decorateClass([
  state4()
], UmbContentFieldVisibilityDashboardElement.prototype, "_pageTypes", 2);
__decorateClass([
  state4()
], UmbContentFieldVisibilityDashboardElement.prototype, "_blockTypes", 2);
__decorateClass([
  state4()
], UmbContentFieldVisibilityDashboardElement.prototype, "_pageTags", 2);
__decorateClass([
  state4()
], UmbContentFieldVisibilityDashboardElement.prototype, "_blockTags", 2);
__decorateClass([
  state4()
], UmbContentFieldVisibilityDashboardElement.prototype, "_pageTypeUnique", 2);
__decorateClass([
  state4()
], UmbContentFieldVisibilityDashboardElement.prototype, "_blockTypeKey", 2);
__decorateClass([
  state4()
], UmbContentFieldVisibilityDashboardElement.prototype, "_blockListScope", 2);
__decorateClass([
  state4()
], UmbContentFieldVisibilityDashboardElement.prototype, "_activeBlockConfigKey", 2);
__decorateClass([
  state4()
], UmbContentFieldVisibilityDashboardElement.prototype, "_nestedContextOptions", 2);
__decorateClass([
  state4()
], UmbContentFieldVisibilityDashboardElement.prototype, "_nestedContextValue", 2);
__decorateClass([
  state4()
], UmbContentFieldVisibilityDashboardElement.prototype, "_loadingPageTypes", 2);
__decorateClass([
  state4()
], UmbContentFieldVisibilityDashboardElement.prototype, "_loadingBlockTypes", 2);
__decorateClass([
  state4()
], UmbContentFieldVisibilityDashboardElement.prototype, "_loadingTags", 2);
__decorateClass([
  state4()
], UmbContentFieldVisibilityDashboardElement.prototype, "_error", 2);
UmbContentFieldVisibilityDashboardElement = __decorateClass([
  customElement3("umb-content-field-visibility-dashboard")
], UmbContentFieldVisibilityDashboardElement);
var content_field_visibility_dashboard_element_default = UmbContentFieldVisibilityDashboardElement;
export {
  UmbContentFieldVisibilityDashboardElement,
  content_field_visibility_dashboard_element_default as default
};
