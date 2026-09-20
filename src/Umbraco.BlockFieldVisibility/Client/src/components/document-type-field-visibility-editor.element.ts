import { css, customElement, html, nothing, property, repeat, state } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import { UmbContentTypeStructureManager } from "@umbraco-cms/backoffice/content-type";
import {
  UmbDocumentTypeDetailRepository,
  UMB_DOCUMENT_TYPE_DETAIL_REPOSITORY_ALIAS,
} from "@umbraco-cms/backoffice/document-type";
import type { UmbBlockFieldVisibilityMap, UmbDocumentTypePropertyListItem } from "../types.js";
import {
  buildDocumentVisibilityLayout,
  type DocumentVisibilityLayout,
  type DocumentVisibilityTab,
} from "../utils/build-document-visibility-layout.js";
import {
  applyFieldVisibilityToggle,
  resolveFieldVisibility,
  saveFieldVisibilityToLocalStorage,
  saveFieldVisibilityToServer,
} from "../utils/document-field-visibility-persistence.js";
import { notifyDocumentTypeFieldVisibilityUpdated } from "../utils/document-type-field-visibility-storage.js";
import {
  notifyFieldVisibilitySaveFailed,
  notifyFieldVisibilitySaved,
} from "../utils/field-visibility-notifications.js";
import { UmbFieldVisibilityRowStyles } from "../styles/field-visibility-row.styles.js";

@customElement("umb-document-type-field-visibility-editor")
export class UmbDocumentTypeFieldVisibilityEditorElement extends UmbLitElement {
  @property({ type: String, attribute: "document-type-unique" })
  documentTypeUnique = "";

  /** Renders tabs in the parent uui-box header (dashboard). */
  @property({ type: Boolean, attribute: "embedded" })
  embedded = false;

  #documentTypeRepository = new UmbDocumentTypeDetailRepository(this);
  #structure = new UmbContentTypeStructureManager(this, UMB_DOCUMENT_TYPE_DETAIL_REPOSITORY_ALIAS);

  @state()
  private _layout: DocumentVisibilityLayout = { tabs: [], showTabBar: false };

  @state()
  private _activeTabKey = "";

  @state()
  private _fieldVisibility: UmbBlockFieldVisibilityMap = {};

  @state()
  private _loading = false;

  @state()
  private _error?: string;

  @state()
  private _saving = false;

  override updated(changed: Map<string, unknown>) {
    if (changed.has("documentTypeUnique")) {
      void this.#load();
    }
  }

  async #load() {
    const contentTypeUnique = this.documentTypeUnique;
    if (!contentTypeUnique) {
      this._layout = { tabs: [], showTabBar: false };
      return;
    }

    this._loading = true;
    this._error = undefined;

    try {
      const [{ data: documentType }, layout] = await Promise.all([
        this.#documentTypeRepository.requestByUnique(contentTypeUnique),
        this.#structure.loadType(contentTypeUnique).then(() => buildDocumentVisibilityLayout(this, this.#structure)),
      ]);

      this._fieldVisibility = await resolveFieldVisibility(this, contentTypeUnique, documentType);
      this._layout = layout;

      if (!this._activeTabKey || !layout.tabs.some((tab) => tab.key === this._activeTabKey)) {
        this._activeTabKey = layout.tabs[0]?.key ?? "";
      }
    } catch {
      this._error = "Could not load properties for this page type.";
      this._layout = { tabs: [], showTabBar: false };
    }

    this._loading = false;
  }

  async #setVisibility(alias: string, hide: boolean, label: string) {
    const contentTypeUnique = this.documentTypeUnique;
    if (!contentTypeUnique) {
      return;
    }

    const next = applyFieldVisibilityToggle(this._fieldVisibility, alias, hide);
    this._fieldVisibility = next;
    notifyDocumentTypeFieldVisibilityUpdated(contentTypeUnique, next);

    this._saving = true;
    this._error = undefined;

    saveFieldVisibilityToLocalStorage(contentTypeUnique, next);
    const serverSaved = await saveFieldVisibilityToServer(this, contentTypeUnique, next);

    this._saving = false;

    if (!serverSaved) {
      const message =
        "Could not save field visibility to the server. Rules still apply in this browser until you sign out; check that you are signed in and try again.";
      this._error = message;
      await notifyFieldVisibilitySaveFailed(this, message);
    } else {
      this._error = undefined;
      await notifyFieldVisibilitySaved(this, label, hide);
    }
  }

  #activeTab(): DocumentVisibilityTab | undefined {
    return this._layout.tabs.find((tab) => tab.key === this._activeTabKey) ?? this._layout.tabs[0];
  }

  #tabLabel(tab: DocumentVisibilityTab) {
    if (tab.name === "#general_generic") {
      return this.localize.string("#general_generic");
    }
    return tab.name;
  }

  override render() {
    if (!this.documentTypeUnique) {
      return nothing;
    }

    const activeTab = this.#activeTab();
    const tabBar = this._layout.showTabBar
      ? html`
          <uui-tab-group slot=${this.embedded ? undefined : "header"}>
            ${repeat(
              this._layout.tabs,
              (tab) => tab.key,
              (tab) => html`
                <uui-tab
                  .label=${this.#tabLabel(tab)}
                  ?active=${tab.key === this._activeTabKey}
                  @click=${() => {
                    this._activeTabKey = tab.key;
                  }}
                ></uui-tab>
              `,
            )}
          </uui-tab-group>
        `
      : nothing;

    const body = html`
      ${tabBar}

      <p class="help-text uui-text">
        Choose which properties are hidden in the backoffice for this page type. Hidden fields keep their stored values.
      </p>

      ${this._loading ? html`<uui-loader></uui-loader>` : nothing}
      ${this._saving ? html`<p class="status-text">Saving…</p>` : nothing}
      ${this._error ? html`<p class="error-text">${this._error}</p>` : nothing}
      ${!this._loading && !this._layout.tabs.length
        ? html`<p class="uui-text">No properties are configured on this document type.</p>`
        : nothing}

      ${activeTab ? this.#renderTab(activeTab) : nothing}
    `;

    if (this.embedded) {
      return body;
    }

    return html`<uui-box headline="Page properties">${body}</uui-box>`;
  }

  #renderTab(tab: DocumentVisibilityTab) {
    return html`
      ${repeat(
        tab.sections,
        (section, index) => `${section.name}-${index}`,
        (section) => html`
          ${section.showHeadline
            ? html`
                <uui-box .headline=${section.name}>
                  ${section.properties.map((property) => this.#renderRow(property))}
                </uui-box>
              `
            : html`
                <uui-box>
                  ${section.properties.map((property) => this.#renderRow(property))}
                </uui-box>
              `}
        `,
      )}
    `;
  }

  #renderRow(property: UmbDocumentTypePropertyListItem) {
    const hide = this._fieldVisibility[property.alias] === true;

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
            void this.#setVisibility(property.alias, target.checked === true, property.name);
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

      uui-box uui-box {
        --uui-box-default-padding: 0 var(--uui-size-space-5);
        margin-top: var(--uui-size-layout-1);
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "umb-document-type-field-visibility-editor": UmbDocumentTypeFieldVisibilityEditorElement;
  }
}
