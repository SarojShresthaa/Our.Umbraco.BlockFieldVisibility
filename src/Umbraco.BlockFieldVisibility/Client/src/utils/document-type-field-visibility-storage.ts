import type { UmbDocumentTypeDetailModel } from "@umbraco-cms/backoffice/document-type";
import type { UmbBlockFieldVisibilityMap } from "../types.js";

const MARKER_START = "\n__UMBRACO_BLOCK_FIELD_VISIBILITY__\n";
const MARKER_END = "\n__END_UMBRACO_BLOCK_FIELD_VISIBILITY__\n";

const memoryByContentType = new Map<string, UmbBlockFieldVisibilityMap>();

export function cacheFieldVisibilityInMemory(
  contentTypeUnique: string,
  fieldVisibility: UmbBlockFieldVisibilityMap,
) {
  memoryByContentType.set(contentTypeUnique, { ...fieldVisibility });
}

export function getFieldVisibilityFromDocumentType(
  documentType: UmbDocumentTypeDetailModel | undefined,
): UmbBlockFieldVisibilityMap {
  if (!documentType?.unique) {
    return {};
  }

  const cached = memoryByContentType.get(documentType.unique);
  if (cached) {
    return { ...cached };
  }

  return parseFromDescription(documentType.description ?? "");
}

export function setFieldVisibilityOnDocumentType(
  documentType: UmbDocumentTypeDetailModel,
  fieldVisibility: UmbBlockFieldVisibilityMap,
): UmbDocumentTypeDetailModel {
  memoryByContentType.set(documentType.unique, { ...fieldVisibility });

  const withoutMarker = stripFieldVisibilityMarker(documentType.description ?? "");
  const payload = JSON.stringify(fieldVisibility);
  const description =
    withoutMarker.trim().length > 0
      ? `${withoutMarker.trim()}${MARKER_START}${payload}${MARKER_END}`
      : `${MARKER_START}${payload}${MARKER_END}`;

  return { ...documentType, description };
}

function parseFromDescription(description: string): UmbBlockFieldVisibilityMap {
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

function parseLegacyHtmlComment(description: string): UmbBlockFieldVisibilityMap {
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

function parseJsonMap(raw: string): UmbBlockFieldVisibilityMap {
  try {
    const parsed = JSON.parse(raw) as UmbBlockFieldVisibilityMap;
    return typeof parsed === "object" && parsed !== null ? { ...parsed } : {};
  } catch {
    return {};
  }
}

function stripFieldVisibilityMarker(description: string): string {
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

export const DOCUMENT_TYPE_FIELD_VISIBILITY_UPDATED = "umbraco-block-field-visibility-document-type-updated";

export function notifyDocumentTypeFieldVisibilityUpdated(
  contentTypeUnique: string,
  fieldVisibility: UmbBlockFieldVisibilityMap,
) {
  cacheFieldVisibilityInMemory(contentTypeUnique, fieldVisibility);

  window.dispatchEvent(
    new CustomEvent(DOCUMENT_TYPE_FIELD_VISIBILITY_UPDATED, {
      detail: { contentTypeUnique, fieldVisibility },
    }),
  );
}
