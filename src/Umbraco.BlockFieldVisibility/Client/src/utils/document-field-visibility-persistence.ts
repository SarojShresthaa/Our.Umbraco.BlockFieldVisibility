import type { UmbControllerHost } from "@umbraco-cms/backoffice/controller-api";
import { UMB_AUTH_CONTEXT } from "@umbraco-cms/backoffice/auth";
import type { UmbDocumentTypeDetailModel } from "@umbraco-cms/backoffice/document-type";
import type { UmbBlockFieldVisibilityMap } from "../types.js";
import {
  cacheFieldVisibilityInMemory,
  getFieldVisibilityFromDocumentType,
} from "./document-type-field-visibility-storage.js";

const LOCAL_STORAGE_KEY = "umbraco.block-field-visibility.v1";
const API_PATH = "/umbraco/management/api/v1/block-field-visibility";

function readLocalStore(): Record<string, UmbBlockFieldVisibilityMap> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Record<string, UmbBlockFieldVisibilityMap>;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/** Keeps only explicit hide rules so counts and server JSON stay in sync. */
export function normalizeFieldVisibilityMap(
  fieldVisibility: UmbBlockFieldVisibilityMap,
): UmbBlockFieldVisibilityMap {
  const normalized: UmbBlockFieldVisibilityMap = {};
  for (const [alias, hide] of Object.entries(fieldVisibility)) {
    if (hide === true) {
      normalized[alias] = true;
    }
  }
  return normalized;
}

export function applyFieldVisibilityToggle(
  fieldVisibility: UmbBlockFieldVisibilityMap,
  alias: string,
  hide: boolean,
): UmbBlockFieldVisibilityMap {
  const next = { ...fieldVisibility };
  if (hide) {
    next[alias] = true;
  } else {
    delete next[alias];
  }
  return normalizeFieldVisibilityMap(next);
}

export function saveFieldVisibilityToLocalStorage(
  contentTypeUnique: string,
  fieldVisibility: UmbBlockFieldVisibilityMap,
) {
  const normalized = normalizeFieldVisibilityMap(fieldVisibility);
  const store = readLocalStore();
  store[contentTypeUnique] = normalized;
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));
  cacheFieldVisibilityInMemory(contentTypeUnique, normalized);
}

function loadFromLocalStorage(contentTypeUnique: string): UmbBlockFieldVisibilityMap | undefined {
  const map = readLocalStore()[contentTypeUnique];
  return map ? { ...map } : undefined;
}

async function requestFieldVisibilityApi(
  host: UmbControllerHost,
  documentTypeUnique: string,
  init?: RequestInit,
): Promise<Response> {
  const authContext = await host.getContext(UMB_AUTH_CONTEXT);
  if (!authContext) {
    return new Response(null, { status: 401, statusText: "Not authenticated" });
  }

  const openApi = authContext.getOpenApiConfiguration();
  // Umbraco 17+ returns the literal "[redacted]" here; the backoffice sends the real token
  // from the httpOnly cookie when this header is present (HideBackOfficeTokensHandler).
  const token = await openApi.token();
  const headers = new Headers(init?.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (init?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const base = openApi.base?.replace(/\/$/, "") ?? "";
  const url = `${base}${API_PATH}/${encodeURIComponent(documentTypeUnique)}`;

  return fetch(url, {
    ...init,
    credentials: openApi.credentials ?? "include",
    headers,
  });
}

export async function loadFieldVisibilityFromServer(
  host: UmbControllerHost,
  contentTypeUnique: string,
): Promise<UmbBlockFieldVisibilityMap | undefined> {
  try {
    const response = await requestFieldVisibilityApi(host, contentTypeUnique);

    if (response.status === 404) {
      return {};
    }

    if (!response.ok) {
      return undefined;
    }

    const data = (await response.json()) as UmbBlockFieldVisibilityMap;
    return typeof data === "object" && data !== null ? { ...data } : {};
  } catch {
    return undefined;
  }
}

export async function saveFieldVisibilityToServer(
  host: UmbControllerHost,
  contentTypeUnique: string,
  fieldVisibility: UmbBlockFieldVisibilityMap,
): Promise<boolean> {
  const normalized = normalizeFieldVisibilityMap(fieldVisibility);
  try {
    const response = await requestFieldVisibilityApi(host, contentTypeUnique, {
      method: "PUT",
      body: JSON.stringify(normalized),
    });

    return response.ok;
  } catch {
    return false;
  }
}

export async function resolveFieldVisibility(
  host: UmbControllerHost,
  contentTypeUnique: string,
  documentType?: UmbDocumentTypeDetailModel,
): Promise<UmbBlockFieldVisibilityMap> {
  const fromServer = await loadFieldVisibilityFromServer(host, contentTypeUnique);
  if (fromServer !== undefined) {
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
