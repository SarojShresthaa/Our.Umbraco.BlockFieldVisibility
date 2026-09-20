import { css, customElement, html, nothing, repeat, state } from "@umbraco-cms/backoffice/external/lit";

import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";

import { UmbTextStyles } from "@umbraco-cms/backoffice/style";

import type { UmbWorkspaceViewElement } from "@umbraco-cms/backoffice/workspace";

import { UMB_DOCUMENT_WORKSPACE_CONTEXT } from "@umbraco-cms/backoffice/document";

import { UmbDocumentTypeDetailRepository } from "@umbraco-cms/backoffice/document-type";

import type { UmbBlockFieldVisibilityMap, UmbDocumentTypePropertyListItem } from "../types.js";

import {

  buildDocumentVisibilityLayout,

  type DocumentVisibilityLayout,

  type DocumentVisibilityTab,

} from "../utils/build-document-visibility-layout.js";

import { syncDocumentHideRules } from "../utils/apply-property-view-guard-rules.js";
import {
  resolveFieldVisibility,
  saveFieldVisibilityToLocalStorage,
  saveFieldVisibilityToServer,
} from "../utils/document-field-visibility-persistence.js";
import { notifyDocumentTypeFieldVisibilityUpdated } from "../utils/document-type-field-visibility-storage.js";



@customElement("umb-document-field-visibility-workspace-view")

export class UmbDocumentFieldVisibilityWorkspaceViewElement

  extends UmbLitElement

  implements UmbWorkspaceViewElement

{

  #documentTypeRepository = new UmbDocumentTypeDetailRepository(this);
  #documentWorkspace?: typeof UMB_DOCUMENT_WORKSPACE_CONTEXT.TYPE;
  #contentTypeUnique?: string;



  @state()

  private _layout: DocumentVisibilityLayout = { tabs: [], showTabBar: false };



  @state()

  private _activeTabKey = "";



  @state()

  private _fieldVisibility: UmbBlockFieldVisibilityMap = {};



  @state()

  private _loading = true;



  @state()

  private _error?: string;



  @state()

  private _saving = false;



  constructor() {

    super();



    this.consumeContext(UMB_DOCUMENT_WORKSPACE_CONTEXT, (workspace) => {
      this.#documentWorkspace = workspace;

      if (!workspace) {
        this._loading = false;
        return;
      }

      const reload = () => {
        void this.#load(workspace);
      };



      this.observe(workspace.structure.contentTypeLoaded, (loaded) => {

        if (loaded) {

          reload();

        }

      });



      void workspace.structure.whenLoaded().then((loaded) => {

        if (loaded) {

          reload();

        }

      });

    });

  }



  async #load(workspace: typeof UMB_DOCUMENT_WORKSPACE_CONTEXT.TYPE) {

    const contentTypeUnique = workspace.getContentTypeUnique();

    if (!contentTypeUnique) {

      this._loading = false;

      this._layout = { tabs: [], showTabBar: false };

      return;

    }



    this.#contentTypeUnique = contentTypeUnique;

    this._loading = true;

    this._error = undefined;



    try {

      const [{ data: documentType }, layout] = await Promise.all([

        this.#documentTypeRepository.requestByUnique(contentTypeUnique),

        buildDocumentVisibilityLayout(this, workspace.structure),

      ]);



      this._fieldVisibility = await resolveFieldVisibility(this, contentTypeUnique, documentType);
      await this.#applyHideRules(this._fieldVisibility);

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



  async #applyHideRules(fieldVisibility: UmbBlockFieldVisibilityMap) {
    const workspace = this.#documentWorkspace;
    if (!workspace) {
      return;
    }

    await workspace.structure.whenLoaded();
    await syncDocumentHideRules(workspace, fieldVisibility);
  }

  async #setVisibility(alias: string, hide: boolean) {

    if (!this.#contentTypeUnique) {

      return;

    }



    const next = { ...this._fieldVisibility, [alias]: hide };

    this._fieldVisibility = next;

    notifyDocumentTypeFieldVisibilityUpdated(this.#contentTypeUnique, next);
    await this.#applyHideRules(next);

    this._saving = true;
    this._error = undefined;

    saveFieldVisibilityToLocalStorage(this.#contentTypeUnique, next);
    const serverSaved = await saveFieldVisibilityToServer(this, this.#contentTypeUnique, next);

    this._saving = false;

    if (!serverSaved) {
      this._error =
        "Could not save field visibility to the server. Rules still apply in this browser until you sign out; check that you are signed in and try again.";
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

    const activeTab = this.#activeTab();



    return html`

      <umb-body-layout header-fit-height>

        ${this._layout.showTabBar

          ? html`

              <uui-tab-group slot="header">

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

          : nothing}



        <div id="layout">

          <p class="help">

            Choose which properties are hidden on the Content tab for pages of this type. Layout matches the Content

            editor (tabs and groups). Hidden fields keep their stored values; only the backoffice UI is affected.

          </p>



          ${this._loading ? html`<uui-loader></uui-loader>` : nothing}

          ${this._saving ? html`<uui-loader></uui-loader>` : nothing}

          ${this._error ? html`<p class="error">${this._error}</p>` : nothing}

          ${!this._loading && !this._layout.tabs.length

            ? html`<p>No properties are configured on this document type.</p>`

            : nothing}



          ${activeTab ? this.#renderTab(activeTab) : nothing}

        </div>

      </umb-body-layout>

    `;

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

          <span class="name">${property.name}</span>

          <span class="alias">${property.alias}</span>

        </div>

        <uui-toggle

          .checked=${hide}

          @change=${(e: Event) => {

            const target = e.target as { checked?: boolean };

            void this.#setVisibility(property.alias, target.checked === true);

          }}

          label="Hide"

        ></uui-toggle>

      </div>

    `;

  }



  static override styles = [

    UmbTextStyles,

    css`

      :host {

        display: block;

        height: 100%;

      }



      #layout {

        padding: var(--uui-size-layout-1);

        padding-bottom: var(--uui-size-layout-2);

      }



      .help {

        margin-top: 0;

        margin-bottom: var(--uui-size-layout-1);

        color: var(--uui-color-text-alt);

      }



      .error {

        color: var(--uui-color-danger);

      }



      uui-box {

        --uui-box-default-padding: 0 var(--uui-size-space-5);

      }



      uui-box:not(:first-of-type) {

        margin-top: var(--uui-size-layout-1);

      }



      uui-tab-group {

        --uui-tab-divider: var(--uui-color-border);

        border-left: 1px solid var(--uui-color-border);

        border-right: 1px solid var(--uui-color-border);

      }



      .field-row {

        display: flex;

        align-items: center;

        justify-content: space-between;

        gap: var(--uui-size-space-4);

        padding: var(--uui-size-space-3) 0;

        border-bottom: 1px solid var(--uui-color-divider);

      }



      .field-row:last-child {

        border-bottom: none;

      }



      .field-label {

        display: flex;

        flex-direction: column;

        gap: var(--uui-size-space-1);

        min-width: 0;

      }



      .name {

        font-weight: 600;

      }



      .alias {

        font-size: 0.85em;

        color: var(--uui-color-text-alt);

      }

    `,

  ];

}



export default UmbDocumentFieldVisibilityWorkspaceViewElement;



declare global {

  interface HTMLElementTagNameMap {

    "umb-document-field-visibility-workspace-view": UmbDocumentFieldVisibilityWorkspaceViewElement;

  }

}


