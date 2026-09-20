import { css, customElement, html, nothing, property, state } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import type { UmbBlockFieldVisibilityMap } from "../types.js";
import { parseBlockListDataTypeFromScope } from "../utils/load-all-unique-block-type-options.js";
import { saveBlockTypeVisibilityAcrossAllBlockLists } from "../utils/save-block-type-visibility-all-block-lists.js";
import { notifyFieldVisibilityBatchSaved } from "../utils/field-visibility-notifications.js";
import { UmbFieldVisibilityRowStyles } from "../styles/field-visibility-row.styles.js";
import "./block-field-visibility-block-editor.element.js";

@customElement("umb-block-type-field-visibility-panel")
export class UmbBlockTypeFieldVisibilityPanelElement extends UmbLitElement {
  @property({ type: String, attribute: "content-element-type-key" })
  contentElementTypeKey = "";

  @property({ type: String, attribute: false })
  blockName = "";

  @property({ type: String, attribute: false })
  settingsElementTypeKey?: string;

  @property({ type: Object, attribute: false })
  fieldVisibility: UmbBlockFieldVisibilityMap = {};

  @property({ type: Object, attribute: false })
  settingsFieldVisibility: UmbBlockFieldVisibilityMap = {};

  /** When set, saves only to this Block List data type (nested lists included). */
  @property({ type: String, attribute: "block-list-scope" })
  blockListScope = "";

  @state()
  private _fieldVisibility: UmbBlockFieldVisibilityMap = {};

  @state()
  private _settingsFieldVisibility: UmbBlockFieldVisibilityMap = {};

  @state()
  private _saving = false;

  @state()
  private _error?: string;

  @state()
  private _saveMessage?: string;

  #saveTimer?: ReturnType<typeof setTimeout>;

  override updated(changed: Map<string, unknown>) {
    if (
      changed.has("contentElementTypeKey") ||
      changed.has("fieldVisibility") ||
      changed.has("settingsFieldVisibility") ||
      changed.has("blockListScope")
    ) {
      this._fieldVisibility = { ...this.fieldVisibility };
      this._settingsFieldVisibility = { ...this.settingsFieldVisibility };
      this._saveMessage = undefined;
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer);
    }
  }

  #onContentChange(event: CustomEvent<{ target: "content" | "settings"; alias: string; hide: boolean }>) {
    const { alias, hide } = event.detail;
    this._fieldVisibility = { ...this._fieldVisibility, [alias]: hide };
    this.#scheduleSave();
  }

  #onSettingsChange(event: CustomEvent<{ target: "content" | "settings"; alias: string; hide: boolean }>) {
    const { alias, hide } = event.detail;
    this._settingsFieldVisibility = { ...this._settingsFieldVisibility, [alias]: hide };
    this.#scheduleSave();
  }

  #scheduleSave() {
    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer);
    }
    this.#saveTimer = setTimeout(() => void this.#save(), 400);
  }

  async #save() {
    const key = this.contentElementTypeKey;
    if (!key) {
      return;
    }

    this._saving = true;
    this._error = undefined;
    this._saveMessage = undefined;

    const { saved, failed } = await saveBlockTypeVisibilityAcrossAllBlockLists(
      this,
      key,
      this._fieldVisibility,
      this._settingsFieldVisibility,
      parseBlockListDataTypeFromScope(this.blockListScope),
    );

    this._saving = false;

    if (!saved && failed) {
      this._error = "Could not save. You may need permission to edit data types.";
      await notifyFieldVisibilityBatchSaved(this, this._error, "danger");
      return;
    }

    this._saveMessage =
      saved > 0
        ? `Saved to ${saved} Block List data type${saved === 1 ? "" : "s"}. Open or refresh the page, then expand the block to apply hides.`
        : "This block type is not used on any Block List data type yet.";

    await notifyFieldVisibilityBatchSaved(
      this,
      this._saveMessage,
      saved > 0 ? "positive" : "warning",
    );
  }

  override render() {
    if (!this.contentElementTypeKey) {
      return nothing;
    }

    return html`
      <uui-box .headline=${this.blockName || "Block type"}>
        ${this._saving ? html`<p class="status-text">Saving…</p>` : nothing}
        ${this._saveMessage ? html`<p class="status-text">${this._saveMessage}</p>` : nothing}
        ${this._error ? html`<p class="error-text">${this._error}</p>` : nothing}

        <umb-block-field-visibility-block-editor
          hide-headline
          .blockName=${this.blockName}
          .contentElementTypeKey=${this.contentElementTypeKey}
          .settingsElementTypeKey=${this.settingsElementTypeKey}
          .fieldVisibility=${this._fieldVisibility}
          .settingsFieldVisibility=${this._settingsFieldVisibility}
          @field-visibility-change=${(e: CustomEvent) => {
            if (e.detail.target === "settings") {
              this.#onSettingsChange(e);
            } else {
              this.#onContentChange(e);
            }
          }}
        ></umb-block-field-visibility-block-editor>
      </uui-box>
    `;
  }

  static override styles = [UmbTextStyles, UmbFieldVisibilityRowStyles];
}

declare global {
  interface HTMLElementTagNameMap {
    "umb-block-type-field-visibility-panel": UmbBlockTypeFieldVisibilityPanelElement;
  }
}
