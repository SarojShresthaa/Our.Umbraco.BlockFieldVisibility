import { css, customElement, html, nothing, state } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import type { UmbWorkspaceViewElement } from "@umbraco-cms/backoffice/workspace";
import { UMB_BLOCK_MANAGER_CONTEXT, UMB_BLOCK_WORKSPACE_CONTEXT } from "@umbraco-cms/backoffice/block";
import { UMB_PROPERTY_CONTEXT } from "@umbraco-cms/backoffice/property";
import { UMB_CONTENT_WORKSPACE_CONTEXT } from "@umbraco-cms/backoffice/content";
import { UmbDataTypeDetailRepository } from "@umbraco-cms/backoffice/data-type";
import { getBlockListPropertyAliasFromRoute } from "../utils/get-block-list-property-alias-from-route.js";
import { tryOptionalAncestorContext, tryOptionalContext } from "../utils/try-optional-context.js";
import {
  UmbDocumentTypeItemRepository,
  type UmbDocumentTypeItemModel,
} from "@umbraco-cms/backoffice/document-type";
import type { UmbBlockFieldVisibilityMap, UmbBlockTypeWithFieldVisibility } from "../types.js";
import { setBlocksOnDataType, updatePropertyConfigBlocks } from "../utils/data-type-block-visibility.js";
import { patchBlockTypeVisibility } from "../utils/patch-block-type-visibility.js";

@customElement("umb-block-field-visibility-block-workspace-view")
export class UmbBlockFieldVisibilityBlockWorkspaceViewElement
  extends UmbLitElement
  implements UmbWorkspaceViewElement
{
  #blockManager?: typeof UMB_BLOCK_MANAGER_CONTEXT.TYPE;
  #dataTypeRepository = new UmbDataTypeDetailRepository(this);
  #documentTypeItems = new UmbDocumentTypeItemRepository(this);

  @state()
  private _contentElementTypeKey?: string;

  @state()
  private _blockName = "";

  @state()
  private _settingsElementTypeKey?: string;

  @state()
  private _fieldVisibility: UmbBlockFieldVisibilityMap = {};

  @state()
  private _settingsFieldVisibility: UmbBlockFieldVisibilityMap = {};

  @state()
  private _dataTypeUnique?: string;

  @state()
  private _error?: string;

  @state()
  private _saving = false;

  constructor() {
    super();

    this.consumeContext(UMB_BLOCK_MANAGER_CONTEXT, (blockManager) => {
      this.#blockManager = blockManager;
    });

    this.consumeContext(UMB_BLOCK_WORKSPACE_CONTEXT, (blockWorkspace) => {
      this.observe(blockWorkspace?.content.contentTypeId, (contentTypeId) => {
        this._contentElementTypeKey = contentTypeId;
        void this.#syncFromBlockManager();
      });
    });

  }

  async #resolveDataTypeUnique(): Promise<string | undefined> {
    if (this._dataTypeUnique) {
      return this._dataTypeUnique;
    }

    const contentWorkspace = await tryOptionalAncestorContext(this, UMB_CONTENT_WORKSPACE_CONTEXT);
    if (!contentWorkspace) {
      return undefined;
    }

    const propertyContext = await tryOptionalContext(this, UMB_PROPERTY_CONTEXT, { skipHost: true });
    const alias = propertyContext?.getAlias() ?? getBlockListPropertyAliasFromRoute();
    if (!alias) {
      return undefined;
    }

    const propertyStructure = await contentWorkspace.structure.getPropertyStructureByAlias(alias);
    this._dataTypeUnique = propertyStructure?.dataType.unique;
    return this._dataTypeUnique;
  }

  async #syncFromBlockManager() {
    const key = this._contentElementTypeKey;
    if (!key || !this.#blockManager) {
      return;
    }

    const blockType = this.#blockManager.getBlockTypes().find((b) => b.contentElementTypeKey === key) as
      | UmbBlockTypeWithFieldVisibility
      | undefined;

    if (!blockType) {
      return;
    }

    this._settingsElementTypeKey = blockType.settingsElementTypeKey;
    this._fieldVisibility = { ...(blockType.fieldVisibility ?? {}) };
    this._settingsFieldVisibility = { ...(blockType.settingsFieldVisibility ?? {}) };

    const { data: items } = await this.#documentTypeItems.requestItems([key]);
    const item = (items ?? [])[0] as UmbDocumentTypeItemModel | undefined;
    this._blockName = item?.name ?? key;
  }

  async #applyVisibilityChange(
    event: CustomEvent<{ target: "content" | "settings"; alias: string; hide: boolean }>,
  ) {
    const key = this._contentElementTypeKey;
    if (!key || !this.#blockManager) {
      return;
    }

    const { target, alias, hide } = event.detail;
    const blocks = patchBlockTypeVisibility(
      this.#blockManager.getBlockTypes() as UmbBlockTypeWithFieldVisibility[],
      key,
      target,
      alias,
      hide,
    );

    const updated = blocks.find((b) => b.contentElementTypeKey === key);
    if (updated) {
      this._fieldVisibility = { ...(updated.fieldVisibility ?? {}) };
      this._settingsFieldVisibility = { ...(updated.settingsFieldVisibility ?? {}) };
    }

    this.#blockManager.setBlockTypes(blocks);

    const propertyContext = await tryOptionalContext(this, UMB_PROPERTY_CONTEXT);
    if (propertyContext) {
      propertyContext.setConfig(updatePropertyConfigBlocks(propertyContext.getConfig(), blocks));
    }

    const dataTypeUnique = await this.#resolveDataTypeUnique();
    if (!dataTypeUnique) {
      this._error = "Could not resolve the Block List data type. Changes apply in this session only.";
      return;
    }

    this._saving = true;
    this._error = undefined;

    const { data } = await this.#dataTypeRepository.requestByUnique(dataTypeUnique);
    if (!data) {
      this._error = "Could not load the Block List data type.";
      this._saving = false;
      return;
    }

    const { error } = await this.#dataTypeRepository.save(setBlocksOnDataType(data, blocks));
    this._saving = false;

    if (error) {
      this._error = "Could not save. You may need permission to edit data types.";
    }
  }

  override render() {
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
          @field-visibility-change=${(e: CustomEvent) => this.#applyVisibilityChange(e)}
        ></umb-block-field-visibility-block-editor>
      </div>
    `;
  }

  static override styles = [
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
    `,
  ];
}

export default UmbBlockFieldVisibilityBlockWorkspaceViewElement;

declare global {
  interface HTMLElementTagNameMap {
    "umb-block-field-visibility-block-workspace-view": UmbBlockFieldVisibilityBlockWorkspaceViewElement;
  }
}
