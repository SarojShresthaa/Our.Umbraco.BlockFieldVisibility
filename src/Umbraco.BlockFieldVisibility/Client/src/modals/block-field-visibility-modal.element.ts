import { css, customElement, html, nothing, state } from "@umbraco-cms/backoffice/external/lit";
import { UmbModalBaseElement } from "@umbraco-cms/backoffice/modal";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import { UmbDataTypeDetailRepository } from "@umbraco-cms/backoffice/data-type";
import {
  UmbDocumentTypeItemRepository,
  type UmbDocumentTypeItemModel,
} from "@umbraco-cms/backoffice/document-type";
import type { UmbBlockFieldVisibilityModalData } from "./block-field-visibility.modal-token.js";
import type { UmbBlockTypeWithFieldVisibility } from "../types.js";
import {
  getBlocksFromDataType,
  setBlocksOnDataType,
} from "../utils/data-type-block-visibility.js";
import { notifyBlockFieldVisibilityDataTypeUpdated } from "../utils/block-field-visibility-data-type-events.js";

@customElement("umb-block-field-visibility-modal")
export class UmbBlockFieldVisibilityModalElement extends UmbModalBaseElement<
  UmbBlockFieldVisibilityModalData,
  boolean
> {
  #dataTypeRepository = new UmbDataTypeDetailRepository(this);
  #documentTypeItems = new UmbDocumentTypeItemRepository(this);

  @state()
  private _blocks: UmbBlockTypeWithFieldVisibility[] = [];

  @state()
  private _names = new Map<string, string>();

  @state()
  private _loading = true;

  @state()
  private _error?: string;

  override connectedCallback() {
    super.connectedCallback();
    void this.#load();
  }

  async #load() {
    const unique = this.data?.dataTypeUnique;
    if (!unique) {
      this._error = "Data type could not be resolved.";
      this._loading = false;
      return;
    }

    const { data, error } = await this.#dataTypeRepository.requestByUnique(unique);
    if (error || !data) {
      this._error = "Could not load the Block List data type.";
      this._loading = false;
      return;
    }

    this._blocks = getBlocksFromDataType(data).map((b) => ({
      ...b,
      fieldVisibility: { ...(b.fieldVisibility ?? {}) },
      settingsFieldVisibility: { ...(b.settingsFieldVisibility ?? {}) },
    }));

    const keys = this._blocks.flatMap((b) =>
      [b.contentElementTypeKey, b.settingsElementTypeKey].filter(Boolean),
    ) as string[];

    if (keys.length) {
      const { data: items } = await this.#documentTypeItems.requestItems(keys);
      const map = new Map<string, string>();
      (items ?? []).forEach((item: UmbDocumentTypeItemModel) => map.set(item.unique, item.name));
      this._names = map;
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
  }

  async #save() {
    const unique = this.data?.dataTypeUnique;
    if (!unique) {
      return;
    }

    const { data } = await this.#dataTypeRepository.requestByUnique(unique);
    if (!data) {
      return;
    }

    const toSave = setBlocksOnDataType(data, this._blocks);
    const { error } = await this.#dataTypeRepository.save(toSave);
    if (error) {
      this._error = "Could not save. You may need permission to edit data types.";
      return;
    }

    notifyBlockFieldVisibilityDataTypeUpdated(unique, this._blocks);
    this.value = true;
    this._submitModal();
  }

  override render() {
    return html`
      <umb-body-layout headline=${this.data?.headline ?? "Field visibility"}>
        <uui-button slot="actions" label="Close" @click=${this._rejectModal}></uui-button>
        <uui-button slot="actions" look="primary" color="positive" label="Save" @click=${this.#save}></uui-button>

        <div id="layout">
          <p class="help">
            Configure which block properties are hidden in the editor. This applies to this Block List everywhere it is
            used (including content in the tree). Stored values are not removed.
          </p>

          ${this._loading ? html`<uui-loader></uui-loader>` : nothing}
          ${this._error ? html`<p class="error">${this._error}</p>` : nothing}
          ${!this._loading && !this._blocks.length
            ? html`<p>No block types are configured on this data type.</p>`
            : nothing}

          ${this._blocks.map(
            (block) => html`
              <umb-block-field-visibility-block-editor
                .blockName=${this._names.get(block.contentElementTypeKey) ?? block.contentElementTypeKey}
                .contentElementTypeKey=${block.contentElementTypeKey}
                .settingsElementTypeKey=${block.settingsElementTypeKey}
                .fieldVisibility=${block.fieldVisibility ?? {}}
                .settingsFieldVisibility=${block.settingsFieldVisibility ?? {}}
                @field-visibility-change=${(e: CustomEvent) =>
                  this.#onVisibilityChange(block.contentElementTypeKey, e)}
              ></umb-block-field-visibility-block-editor>
            `,
          )}
        </div>
      </umb-body-layout>
    `;
  }

  static override styles = [
    UmbTextStyles,
    css`
      #layout {
        padding: var(--uui-size-layout-1);
      }

      .help {
        color: var(--uui-color-text-alt);
        margin-top: 0;
      }

      .error {
        color: var(--uui-color-danger);
      }

      umb-block-field-visibility-block-editor {
        display: block;
        margin-bottom: var(--uui-size-space-4);
      }
    `,
  ];
}

export default UmbBlockFieldVisibilityModalElement;

declare global {
  interface HTMLElementTagNameMap {
    "umb-block-field-visibility-modal": UmbBlockFieldVisibilityModalElement;
  }
}
