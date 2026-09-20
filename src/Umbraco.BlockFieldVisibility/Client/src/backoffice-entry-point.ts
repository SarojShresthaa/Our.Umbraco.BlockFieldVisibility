import type { UmbExtensionRegistry } from "@umbraco-cms/backoffice/extension-registry";
import type { UmbControllerHost } from "@umbraco-cms/backoffice/controller-api";
import "./components/block-field-visibility-block-editor.element.js";
import { attachBlockListFieldVisibilityRuntimeSync } from "./block-list-field-visibility-runtime-sync.js";

const PROPERTY_ACTION_API =
  "/App_Plugins/Umbraco.BlockFieldVisibility/block-field-visibility.property-action.js";

export async function onInit(_host: UmbControllerHost, extensionRegistry: UmbExtensionRegistry) {
  attachBlockListFieldVisibilityRuntimeSync();

  extensionRegistry.register({
    type: "propertyAction",
    kind: "default",
    alias: "Umbraco.BlockFieldVisibility.PropertyAction",
    name: "Block Field Visibility Property Action",
    api: PROPERTY_ACTION_API,
    forPropertyEditorUis: ["Umb.PropertyEditorUi.BlockList"],
    weight: 500,
    meta: {
      label: "Field visibility",
      icon: "icon-eye",
    },
  });
}
