import { css, customElement, html, nothing, property, state } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import { UmbDataTypeDetailRepository } from "@umbraco-cms/backoffice/data-type";
import {
  UmbDocumentTypeItemRepository,
  type UmbDocumentTypeItemModel,
} from "@umbraco-cms/backoffice/document-type";
import type { UmbBlockTypeWithFieldVisibility } from "../types.js";
import { getBlocksFromDataType, setBlocksOnDataType } from "../utils/data-type-block-visibility.js";
import { notifyBlockFieldVisibilityDataTypeUpdated } from "../utils/block-field-visibility-data-type-events.js";
import "./block-field-visibility-block-editor.element.js";

@customElement("umb-block-list-field-visibility-panel")
export class UmbBlockListFieldVisibilityPanelElement extends UmbLitElement {
  @property({ type: String, attribute: "data-type-unique" })
  dataTypeUnique = "";

  @property({ type: String })
  headline = "Block list";

  @property({ type: String, attribute: false })
  propertyAlias = "";

  #dataTypeRepository = new UmbDataTypeDetailRepository(this);
  #documentTypeItems = new UmbDocumentTypeItemRepository(this);
  #saveTimer?: ReturnType<typeof setTimeout>;

  @state()
  private _blocks: UmbBlockTypeWithFieldVisibility[] = [];

  @state()
  private _names = new Map<string, string>();

  @state()
  private _loading = false;

  @state()
  private _error?: string;

  @state()
  private _saving = false;

  /** Which block type editor is expanded (collapsed by default). */
  @state()
  private _expandedBlockKey: string | null = null;

  override updated(changed: Map<string, unknown>) {
    if (changed.has("dataTypeUnique")) {
      void this.#load();
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer);
    }
  }

  async #load() {
    const unique = this.dataTypeUnique;
    if (!unique) {
      this._blocks = [];
      return;
    }

    this._loading = true;
    this._error = undefined;
    this._expandedBlockKey = null;

    const { data, error } = await this.#dataTypeRepository.requestByUnique(unique);
    if (error || !data) {
      this._error = "Could not load the Block List data type.";
      this._blocks = [];
      this._loading = false;
      return;
    }

    this._blocks = getBlocksFromDataType(data).map((block) => ({
      ...block,
      fieldVisibility: { ...(block.fieldVisibility ?? {}) },
      settingsFieldVisibility: { ...(block.settingsFieldVisibility ?? {}) },
    }));

    const keys = this._blocks.flatMap((block) =>
      [block.contentElementTypeKey, block.settingsElementTypeKey].filter(Boolean),
    ) as string[];

    if (keys.length) {
      const { data: items } = await this.#documentTypeItems.requestItems(keys);
      const map = new Map<string, string>();
      (items ?? []).forEach((item: UmbDocumentTypeItemModel) => map.set(item.unique, item.name));
      this._names = map;
    } else {
      this._names = new Map();
    }

    this._loading = false;
  }

  #onVisibilityChange(
    contentElementTypeKey: string,
    event: CustomEvent<{ target: "content" | "settings"; alias: string; hide: boolean }>,
  ) {
    const { target, alias, hide } = event.detail;
    this._blocks = this._blocks.map((block) => {
      if (block.contentElementTypeKey !== contentElementTypeKey) {
        return block;
      }
      if (target === "content") {
        return {
          ...block,
          fieldVisibility: { ...(block.fieldVisibility ?? {}), [alias]: hide },
        };
      }
      return {
        ...block,
        settingsFieldVisibility: { ...(block.settingsFieldVisibility ?? {}), [alias]: hide },
      };
    });
    this.#scheduleSave();
  }

  #scheduleSave() {
    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer);
    }
    this.#saveTimer = setTimeout(() => void this.#save(), 400);
  }

  async #save() {
    const unique = this.dataTypeUnique;
    if (!unique) {
      return;
    }

    this._saving = true;
    this._error = undefined;

    const { data } = await this.#dataTypeRepository.requestByUnique(unique);
    if (!data) {
      this._error = "Could not load the Block List data type.";
      this._saving = false;
      return;
    }

    const toSave = setBlocksOnDataType(data, this._blocks);
    const { error } = await this.#dataTypeRepository.save(toSave);
    if (error) {
      this._error = "Could not save. You may need permission to edit data types.";
    } else {
      notifyBlockFieldVisibilityDataTypeUpdated(unique, this._blocks);
    }

    this._saving = false;
  }

  #toggleBlock(contentElementTypeKey: string) {
    this._expandedBlockKey =
      this._expandedBlockKey === contentElementTypeKey ? null : contentElementTypeKey;
  }

  #hiddenFieldCount(block: UmbBlockTypeWithFieldVisibility): number {
    const contentHidden = Object.values(block.fieldVisibility ?? {}).filter((hide) => hide === true).length;
    const settingsHidden = Object.values(block.settingsFieldVisibility ?? {}).filter(
      (hide) => hide === true,
    ).length;
    return contentHidden + settingsHidden;
  }

  override render() {
    if (!this.dataTypeUnique) {
      return nothing;
    }

    const title = this.propertyAlias
      ? `${this.headline} (${this.propertyAlias})`
      : this.headline;

    return html`
      <uui-box .headline=${title}>
        <p class="help">
          Block fields hidden here apply wherever this Block List property is used on this page type. Expand a block
          type to configure its fields.
        </p>

        ${this._loading ? html`<uui-loader></uui-loader>` : nothing}
        ${this._saving ? html`<p class="saving">Saving…</p>` : nothing}
        ${this._error ? html`<p class="error">${this._error}</p>` : nothing}
        ${!this._loading && !this._blocks.length
          ? html`<p>No block types are configured on this Block List.</p>`
          : nothing}

        ${this._blocks.map((block) => {
          const blockKey = block.contentElementTypeKey;
          const blockName = this._names.get(blockKey) ?? blockKey;
          const expanded = this._expandedBlockKey === blockKey;
          const hiddenCount = this.#hiddenFieldCount(block);

          return html`
            <div class="block-item">
              <uui-button
                class="block-toggle"
                look="secondary"
                label=${blockName}
                @click=${() => this.#toggleBlock(blockKey)}
              >
                <uui-symbol-expand .open=${expanded}></uui-symbol-expand>
                <span class="block-toggle-label">${blockName}</span>
                ${hiddenCount
                  ? html`<span class="block-badge">${hiddenCount} hidden</span>`
                  : nothing}
              </uui-button>

              ${expanded
                ? html`
                    <div class="block-body">
                      <umb-block-field-visibility-block-editor
                        hide-headline
                        .blockName=${blockName}
                        .contentElementTypeKey=${block.contentElementTypeKey}
                        .settingsElementTypeKey=${block.settingsElementTypeKey}
                        .fieldVisibility=${block.fieldVisibility ?? {}}
                        .settingsFieldVisibility=${block.settingsFieldVisibility ?? {}}
                        @field-visibility-change=${(e: CustomEvent) =>
                          this.#onVisibilityChange(block.contentElementTypeKey, e)}
                      ></umb-block-field-visibility-block-editor>
                    </div>
                  `
                : nothing}
            </div>
          `;
        })}
      </uui-box>
    `;
  }

  static override styles = [
    UmbTextStyles,
    css`
      .help {
        margin-top: 0;
        color: var(--uui-color-text-alt);
      }

      .error {
        color: var(--uui-color-danger);
      }

      .saving {
        color: var(--uui-color-text-alt);
        font-size: 0.9em;
      }

      .block-item {
        margin-top: var(--uui-size-space-3);
        border: 1px solid var(--uui-color-border);
        border-radius: var(--uui-border-radius);
        overflow: hidden;
      }

      .block-toggle {
        width: 100%;
        justify-content: flex-start;
        gap: var(--uui-size-space-2);
        border-radius: 0;
      }

      .block-toggle-label {
        flex: 1;
        text-align: left;
      }

      .block-badge {
        font-size: 0.85em;
        color: var(--uui-color-text-alt);
        font-weight: normal;
      }

      .block-body {
        border-top: 1px solid var(--uui-color-border);
        padding: 0 var(--uui-size-space-2) var(--uui-size-space-2);
      }

      .block-body umb-block-field-visibility-block-editor {
        display: block;
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "umb-block-list-field-visibility-panel": UmbBlockListFieldVisibilityPanelElement;
  }
}
