import { css, html, nothing, property, state } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import type { UmbBlockFieldVisibilityMap, UmbDocumentTypePropertyListItem } from "../types.js";
import { loadElementTypeProperties } from "../utils/load-element-type-properties.js";
import { UmbFieldVisibilityRowStyles } from "../styles/field-visibility-row.styles.js";

const BLOCK_EDITOR_TAG = "umb-block-field-visibility-block-editor";

export class UmbBlockFieldVisibilityBlockEditorElement extends UmbLitElement {
  @property({ type: String, attribute: false })
  blockName = "";

  @property({ type: String, attribute: false })
  contentElementTypeKey?: string;

  @property({ type: String, attribute: false })
  settingsElementTypeKey?: string;

  @property({ type: Object, attribute: false })
  fieldVisibility: UmbBlockFieldVisibilityMap = {};

  @property({ type: Object, attribute: false })
  settingsFieldVisibility: UmbBlockFieldVisibilityMap = {};

  @property({ type: Boolean, attribute: "hide-headline" })
  hideHeadline = false;

  @state()
  private _contentProperties: UmbDocumentTypePropertyListItem[] = [];

  @state()
  private _settingsProperties: UmbDocumentTypePropertyListItem[] = [];

  override updated(changed: Map<string, unknown>) {
    if (changed.has("contentElementTypeKey") || changed.has("settingsElementTypeKey")) {
      void this.#loadProperties();
    }
  }

  async #loadProperties() {
    this._contentProperties = await loadElementTypeProperties(this, this.contentElementTypeKey);
    this._settingsProperties = this.settingsElementTypeKey
      ? await loadElementTypeProperties(this, this.settingsElementTypeKey)
      : [];
  }

  #emitContentChange(alias: string, hide: boolean) {
    this.dispatchEvent(
      new CustomEvent("field-visibility-change", {
        detail: { target: "content", alias, hide },
        bubbles: true,
        composed: true,
      }),
    );
  }

  #emitSettingsChange(alias: string, hide: boolean) {
    this.dispatchEvent(
      new CustomEvent("field-visibility-change", {
        detail: { target: "settings", alias, hide },
        bubbles: true,
        composed: true,
      }),
    );
  }

  override render() {
    const inner = html`
      ${this._contentProperties.length
        ? html`
            <uui-box headline="Content">
              ${this._contentProperties.map((property) =>
                this.#renderRow(property, this.fieldVisibility, (hide) =>
                  this.#emitContentChange(property.alias, hide),
                ),
              )}
            </uui-box>
          `
        : html`<p class="uui-text">No content properties found.</p>`}

      ${this.settingsElementTypeKey
        ? html`
            ${this._settingsProperties.length
              ? html`
                  <uui-box headline="Settings">
                    ${this._settingsProperties.map((property) =>
                      this.#renderRow(property, this.settingsFieldVisibility, (hide) =>
                        this.#emitSettingsChange(property.alias, hide),
                      ),
                    )}
                  </uui-box>
                `
              : html`<p class="uui-text">No settings properties found.</p>`}
          `
        : nothing}
    `;

    if (this.hideHeadline) {
      return html`<div class="editor-inner">${inner}</div>`;
    }

    return html`<uui-box headline=${this.blockName || "Block type"}>${inner}</uui-box>`;
  }

  #renderRow(
    property: UmbDocumentTypePropertyListItem,
    map: UmbBlockFieldVisibilityMap,
    onChange: (hide: boolean) => void,
  ) {
    const hide = map[property.alias] === true;
    return html`
      <div class="field-row">
        <div class="field-label">
          <span class="field-name">${property.name}</span>
          <span class="field-alias">${property.alias}</span>
        </div>
        <uui-toggle
          .checked=${hide}
          @change=${(e: Event) => {
            const target = e.target as { checked?: boolean };
            onChange(target.checked === true);
          }}
          label="Hide"
        ></uui-toggle>
      </div>
    `;
  }

  static override styles = [
    UmbTextStyles,
    UmbFieldVisibilityRowStyles,
    css`
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
    `,
  ];
}

if (!customElements.get(BLOCK_EDITOR_TAG)) {
  customElements.define(BLOCK_EDITOR_TAG, UmbBlockFieldVisibilityBlockEditorElement);
}

export default UmbBlockFieldVisibilityBlockEditorElement;

declare global {
  interface HTMLElementTagNameMap {
    "umb-block-field-visibility-block-editor": UmbBlockFieldVisibilityBlockEditorElement;
  }
}
