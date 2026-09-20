import { css, customElement, html, nothing, state } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import type { UmbWorkspaceViewElement } from "@umbraco-cms/backoffice/workspace";
import { UMB_BLOCK_TYPE_WORKSPACE_CONTEXT } from "@umbraco-cms/backoffice/block-type";
import type { UmbBlockFieldVisibilityMap, UmbDocumentTypePropertyListItem } from "../types.js";
import { loadElementTypeProperties } from "../utils/load-element-type-properties.js";

@customElement("umb-block-list-field-visibility-workspace-view")
export class UmbBlockListFieldVisibilityWorkspaceViewElement
  extends UmbLitElement
  implements UmbWorkspaceViewElement
{
  #workspaceContext?: typeof UMB_BLOCK_TYPE_WORKSPACE_CONTEXT.TYPE;

  @state()
  private _contentProperties: UmbDocumentTypePropertyListItem[] = [];

  @state()
  private _settingsProperties: UmbDocumentTypePropertyListItem[] = [];

  @state()
  private _fieldVisibility: UmbBlockFieldVisibilityMap = {};

  @state()
  private _settingsFieldVisibility: UmbBlockFieldVisibilityMap = {};

  @state()
  private _hasSettingsElement = false;

  constructor() {
    super();

    this.consumeContext(UMB_BLOCK_TYPE_WORKSPACE_CONTEXT, (context) => {
      this.#workspaceContext = context;

      this.observe(context?.unique, async (elementTypeKey) => {
        this._contentProperties = await loadElementTypeProperties(this, elementTypeKey);
      });

      this.observe(context?.data, async (data) => {
        const blockType = data as {
          settingsElementTypeKey?: string;
          fieldVisibility?: UmbBlockFieldVisibilityMap;
          settingsFieldVisibility?: UmbBlockFieldVisibilityMap;
        };

        this._hasSettingsElement = !!blockType?.settingsElementTypeKey;
        this._fieldVisibility = { ...(blockType?.fieldVisibility ?? {}) };
        this._settingsFieldVisibility = { ...(blockType?.settingsFieldVisibility ?? {}) };

        if (blockType?.settingsElementTypeKey) {
          this._settingsProperties = await loadElementTypeProperties(this, blockType.settingsElementTypeKey);
        } else {
          this._settingsProperties = [];
        }
      });
    });
  }

  async #setContentVisibility(alias: string, hide: boolean) {
    const next = { ...this._fieldVisibility, [alias]: hide };
    this._fieldVisibility = next;
    await this.#workspaceContext?.setPropertyValue("fieldVisibility", next);
  }

  async #setSettingsVisibility(alias: string, hide: boolean) {
    const next = { ...this._settingsFieldVisibility, [alias]: hide };
    this._settingsFieldVisibility = next;
    await this.#workspaceContext?.setPropertyValue("settingsFieldVisibility", next);
  }

  override render() {
    return html`
      <uui-box headline="Field visibility">
        <p id="field-visibility-help">
          Choose which properties are hidden when editors work with this block in a Block List. Hidden fields keep
          their stored values; only the backoffice editor UI is affected.
        </p>

        ${this._contentProperties.length
          ? html`
              <h4>Content properties</h4>
              ${this._contentProperties.map((property) => this.#renderRow(property, this._fieldVisibility, (hide) =>
                this.#setContentVisibility(property.alias, hide),
              ))}
            `
          : html`<p>No properties were found on this element type.</p>`}

        ${this._hasSettingsElement
          ? html`
              <h4>Settings properties</h4>
              ${this._settingsProperties.length
                ? this._settingsProperties.map((property) =>
                    this.#renderRow(property, this._settingsFieldVisibility, (hide) =>
                      this.#setSettingsVisibility(property.alias, hide),
                    ),
                  )
                : html`<p>No properties were found on the settings element type.</p>`}
            `
          : nothing}
      </uui-box>
    `;
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
          <span class="name">${property.name}</span>
          <span class="alias">${property.alias}</span>
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
    css`
      :host {
        display: block;
        margin: var(--uui-size-layout-1);
        padding-bottom: var(--uui-size-layout-1);
      }

      #field-visibility-help {
        margin-top: 0;
        color: var(--uui-color-text-alt);
      }

      h4 {
        margin: var(--uui-size-layout-1) 0 var(--uui-size-space-3);
      }

      .field-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--uui-size-space-4);
        padding: var(--uui-size-space-3) 0;
        border-bottom: 1px solid var(--uui-color-border);
      }

      .field-row:last-child {
        border-bottom: none;
      }

      .field-label {
        display: flex;
        flex-direction: column;
        gap: var(--uui-size-space-1);
      }

      .name {
        font-weight: 600;
      }

      .alias {
        font-size: 0.85em;
        color: var(--uui-color-text-alt);
      }

      uui-toggle {
        flex-shrink: 0;
      }
    `,
  ];
}

export default UmbBlockListFieldVisibilityWorkspaceViewElement;

declare global {
  interface HTMLElementTagNameMap {
    "umb-block-list-field-visibility-workspace-view": UmbBlockListFieldVisibilityWorkspaceViewElement;
  }
}
