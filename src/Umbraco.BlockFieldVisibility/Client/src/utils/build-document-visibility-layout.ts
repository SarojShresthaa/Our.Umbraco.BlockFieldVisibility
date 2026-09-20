import type { UmbControllerHost } from "@umbraco-cms/backoffice/controller-api";
import {
  UmbContentTypeContainerStructureHelper,
  UmbContentTypePropertyStructureHelper,
  type UmbContentTypeStructureManager,
} from "@umbraco-cms/backoffice/content-type";
import { firstValueFrom } from "@umbraco-cms/backoffice/external/rxjs";
import type { UmbDocumentTypePropertyListItem } from "../types.js";

export type DocumentVisibilitySection = {
  name: string;
  showHeadline: boolean;
  properties: UmbDocumentTypePropertyListItem[];
};

export type DocumentVisibilityTab = {
  key: string;
  name: string;
  sections: DocumentVisibilitySection[];
};

export type DocumentVisibilityLayout = {
  tabs: DocumentVisibilityTab[];
  showTabBar: boolean;
};

function toListItems(
  properties: Array<{ alias: string; name?: string | null; sortOrder?: number }>,
): UmbDocumentTypePropertyListItem[] {
  return [...properties]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((property) => ({
      alias: property.alias,
      name: property.name ?? property.alias,
    }));
}

async function propertiesAtContainer(
  host: UmbControllerHost,
  structure: UmbContentTypeStructureManager,
  containerId: string | null,
) {
  const propertyHelper = new UmbContentTypePropertyStructureHelper(host);
  propertyHelper.setStructureManager(structure);
  propertyHelper.setContainerId(containerId);
  return toListItems(await firstValueFrom(propertyHelper.propertyStructure));
}

async function sectionsForContainer(
  host: UmbControllerHost,
  structure: UmbContentTypeStructureManager,
  containerId: string | null,
): Promise<DocumentVisibilitySection[]> {
  const groupHelper = new UmbContentTypeContainerStructureHelper(host);
  groupHelper.setStructureManager(structure);
  groupHelper.setContainerChildType("Group");
  groupHelper.setContainerId(containerId);

  const [groups, hasDirectProperties] = await Promise.all([
    firstValueFrom(groupHelper.childContainers),
    firstValueFrom(groupHelper.hasProperties),
  ]);

  const sections: DocumentVisibilitySection[] = [];

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
      properties,
    });
  }

  return sections;
}

export async function buildDocumentVisibilityLayout(
  host: UmbControllerHost,
  structure: UmbContentTypeStructureManager,
): Promise<DocumentVisibilityLayout> {
  await structure.whenLoaded();

  const tabsHelper = new UmbContentTypeContainerStructureHelper(host);
  tabsHelper.setStructureManager(structure);
  tabsHelper.setIsRoot(true);
  tabsHelper.setContainerChildType("Tab");

  const [tabContainers, hasRootProperties, hasRootGroupsObservable] = await Promise.all([
    firstValueFrom(tabsHelper.childContainers),
    firstValueFrom(tabsHelper.hasProperties),
    structure.hasRootContainers("Group"),
  ]);

  const hasRootGroups = await firstValueFrom(hasRootGroupsObservable);
  const tabs: DocumentVisibilityTab[] = [];

  if (hasRootProperties || hasRootGroups) {
    const sections = await sectionsForContainer(host, structure, null);
    if (sections.length) {
      tabs.push({
        key: "root",
        name: "#general_generic",
        sections,
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
      sections,
    });
  }

  return { tabs, showTabBar: tabs.length > 1 };
}
