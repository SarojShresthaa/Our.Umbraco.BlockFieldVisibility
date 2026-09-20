import type { UmbControllerHost } from "@umbraco-cms/backoffice/controller-api";

import {

  UmbDocumentTypeDetailRepository,

  type UmbDocumentTypeDetailModel,

} from "@umbraco-cms/backoffice/document-type";

import type { UmbDocumentTypePropertyListItem } from "../types.js";



async function loadDocumentTypesWithCompositions(

  host: UmbControllerHost,

  rootUnique: string,

): Promise<UmbDocumentTypeDetailModel[]> {

  const repository = new UmbDocumentTypeDetailRepository(host);

  const loaded = new Map<string, UmbDocumentTypeDetailModel>();

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



  const ordered: UmbDocumentTypeDetailModel[] = [];

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



export async function loadElementTypeProperties(

  host: UmbControllerHost,

  elementTypeKey: string | undefined,

): Promise<UmbDocumentTypePropertyListItem[]> {

  if (!elementTypeKey) {

    return [];

  }



  const documentTypes = await loadDocumentTypesWithCompositions(host, elementTypeKey);

  const seenAliases = new Set<string>();

  const properties: UmbDocumentTypePropertyListItem[] = [];



  for (const documentType of documentTypes) {

    for (const property of documentType.properties ?? []) {

      if (seenAliases.has(property.alias)) {

        continue;

      }

      seenAliases.add(property.alias);

      properties.push({

        alias: property.alias,

        name: property.name ?? property.alias,

      });

    }

  }



  return properties;

}


