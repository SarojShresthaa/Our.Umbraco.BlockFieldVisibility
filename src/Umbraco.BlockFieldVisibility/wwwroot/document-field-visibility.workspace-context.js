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

// src/workspace/document-field-visibility.workspace-context.ts
import { UmbControllerBase } from "@umbraco-cms/backoffice/class-api";
import { UMB_DOCUMENT_WORKSPACE_CONTEXT } from "@umbraco-cms/backoffice/document";
import { UmbDocumentTypeDetailRepository } from "@umbraco-cms/backoffice/document-type";
var UmbDocumentFieldVisibilityWorkspaceContext = class extends UmbControllerBase {
  #documentTypeRepository = new UmbDocumentTypeDetailRepository(this);
  #workspace;
  #contentTypeUnique;
  #pendingVisibility = {};
  #visibilityLoaded = false;
  #workspaceLoading = true;
  #resyncTimer;
  #cancelScheduledResync;
  #syncGeneration = 0;
  #onDocumentTypeVisibilityUpdated = (event) => {
    const detail = event.detail;
    if (!detail?.contentTypeUnique || !this.#workspace) {
      return;
    }
    if (this.#contentTypeUnique && detail.contentTypeUnique !== this.#contentTypeUnique) {
      return;
    }
    this.#contentTypeUnique = detail.contentTypeUnique;
    this.#pendingVisibility = detail.fieldVisibility;
    this.#visibilityLoaded = true;
    void this.#reloadFromServerAndSync(this.#workspace, detail.contentTypeUnique, detail.fieldVisibility);
  };
  constructor(host) {
    super(host);
    window.addEventListener(DOCUMENT_TYPE_FIELD_VISIBILITY_UPDATED, this.#onDocumentTypeVisibilityUpdated);
    this.consumeContext(UMB_DOCUMENT_WORKSPACE_CONTEXT, (workspace) => {
      this.#workspace = workspace;
      if (!workspace) {
        return;
      }
      this.observe(workspace.loading.isOn, (loading) => {
        this.#workspaceLoading = loading ?? false;
      });
      this.observe(workspace.contentTypeUnique, (unique) => {
        if (unique) {
          void this.#loadAndSync(workspace);
        }
      });
      this.observe(workspace.structure.contentTypeLoaded, (loaded) => {
        if (loaded) {
          void this.#loadAndSync(workspace);
        }
      });
      void workspace.structure.whenLoaded().then((loaded) => {
        if (loaded) {
          void this.#loadAndSync(workspace);
        }
      });
      this.observe(workspace.structure.contentTypeProperties, (properties) => {
        if (!properties.length || !this.#visibilityLoaded) {
          return;
        }
        this.#scheduleResync(workspace);
      });
    });
  }
  #scheduleResync(workspace) {
    if (this.#resyncTimer) {
      window.clearTimeout(this.#resyncTimer);
    }
    this.#resyncTimer = window.setTimeout(() => {
      void this.#syncVisibility(workspace);
      this.#cancelScheduledResync?.();
      this.#cancelScheduledResync = scheduleVisibilityResync(() => this.#syncVisibility(workspace));
    }, 150);
  }
  async #reloadFromServerAndSync(workspace, contentTypeUnique, fallback) {
    const fromServer = await loadFieldVisibilityFromServer(this, contentTypeUnique);
    this.#pendingVisibility = fromServer ?? fallback;
    this.#visibilityLoaded = true;
    await this.#syncVisibility(workspace);
    this.#cancelScheduledResync?.();
    this.#cancelScheduledResync = scheduleVisibilityResync(() => this.#syncVisibility(workspace));
  }
  async #loadAndSync(workspace) {
    const contentTypeUnique = workspace.getContentTypeUnique();
    if (!contentTypeUnique) {
      return;
    }
    this.#contentTypeUnique = contentTypeUnique;
    const { data: documentType } = await this.#documentTypeRepository.requestByUnique(contentTypeUnique);
    this.#pendingVisibility = await resolveFieldVisibility(this, contentTypeUnique, documentType);
    this.#visibilityLoaded = true;
    await this.#syncVisibility(workspace);
    this.#cancelScheduledResync?.();
    this.#cancelScheduledResync = scheduleVisibilityResync(() => this.#syncVisibility(workspace));
  }
  async #syncVisibility(workspace) {
    if (!this.#visibilityLoaded || this.#workspaceLoading) {
      return;
    }
    const generation = ++this.#syncGeneration;
    try {
      await workspace.structure.whenLoaded();
    } catch {
      return;
    }
    if (generation !== this.#syncGeneration) {
      return;
    }
    await syncDocumentHideRules(workspace, this.#pendingVisibility);
  }
  destroy() {
    if (this.#resyncTimer) {
      window.clearTimeout(this.#resyncTimer);
    }
    this.#cancelScheduledResync?.();
    window.removeEventListener(DOCUMENT_TYPE_FIELD_VISIBILITY_UPDATED, this.#onDocumentTypeVisibilityUpdated);
    super.destroy();
  }
};
export {
  UmbDocumentFieldVisibilityWorkspaceContext as api
};
