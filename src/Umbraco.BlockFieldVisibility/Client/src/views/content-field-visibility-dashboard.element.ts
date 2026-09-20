import { css, customElement, html, nothing, repeat, state } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UmbTextStyles } from "@umbraco-cms/backoffice/style";
import type { UmbDashboardElement } from "@umbraco-cms/backoffice/dashboard";
import "../components/document-type-field-visibility-editor.element.js";
import "../components/block-type-field-visibility-panel.element.js";
import {
  loadFieldVisibilityPageTypeOptions,
  type FieldVisibilityPageTypeOption,
} from "../utils/load-field-visibility-page-type-options.js";
import {
  getBlockVisibilityForScope,
  getNestedPlacements,
  getPlacementScopeValue,
  loadAllUniqueBlockTypeOptions,
  type UniqueBlockTypeOption,
} from "../utils/load-all-unique-block-type-options.js";
import {
  BLOCK_ELEMENT_TYPE_VISIBILITY_UPDATED,
  type BlockElementTypeVisibilityUpdatedDetail,
} from "../utils/block-field-visibility-data-type-events.js";
import { DOCUMENT_TYPE_FIELD_VISIBILITY_UPDATED } from "../utils/document-type-field-visibility-storage.js";
import type { UmbBlockFieldVisibilityMap } from "../types.js";
import {
  loadBlockFieldVisibilityTags,
  loadPageFieldVisibilityTags,
  upsertPageFieldVisibilityTag,
  type FieldVisibilityTag,
} from "../utils/load-field-visibility-tags.js";
import {
  loadNestedBlockListContextOptions,
  NESTED_CONTEXT_SELF,
  parseNestedContextValue,
  type NestedBlockListContextOption,
} from "../utils/load-nested-block-list-context-options.js";

type SelectOption = {
  name: string;
  value: string;
  selected?: boolean;
};

const PAGE_TYPE_PLACEHOLDER = "";
const BLOCK_TYPE_PLACEHOLDER = "";
const BLOCK_SCOPE_ALL = "";

@customElement("umb-content-field-visibility-dashboard")
export class UmbContentFieldVisibilityDashboardElement extends UmbLitElement implements UmbDashboardElement {
  @state()
  private _pageTypes: FieldVisibilityPageTypeOption[] = [];

  @state()
  private _blockTypes: UniqueBlockTypeOption[] = [];

  @state()
  private _pageTags: FieldVisibilityTag[] = [];

  @state()
  private _blockTags: FieldVisibilityTag[] = [];

  @state()
  private _pageTypeUnique = PAGE_TYPE_PLACEHOLDER;

  @state()
  private _blockTypeKey = BLOCK_TYPE_PLACEHOLDER;

  @state()
  private _blockListScope = BLOCK_SCOPE_ALL;

  /** Block type whose fields are edited (may differ when picking a nested item under a parent). */
  @state()
  private _activeBlockConfigKey = BLOCK_TYPE_PLACEHOLDER;

  @state()
  private _nestedContextOptions: NestedBlockListContextOption[] = [];

  @state()
  private _nestedContextValue = NESTED_CONTEXT_SELF;

  @state()
  private _loadingPageTypes = true;

  @state()
  private _loadingBlockTypes = true;

  @state()
  private _loadingTags = false;

  @state()
  private _error?: string;

  override connectedCallback() {
    super.connectedCallback();
    void this.#loadOptions();
    window.addEventListener(BLOCK_ELEMENT_TYPE_VISIBILITY_UPDATED, this.#onBlockVisibilityChanged);
    window.addEventListener(DOCUMENT_TYPE_FIELD_VISIBILITY_UPDATED, this.#onPageVisibilityChanged);
  }

  override disconnectedCallback() {
    window.removeEventListener(BLOCK_ELEMENT_TYPE_VISIBILITY_UPDATED, this.#onBlockVisibilityChanged);
    window.removeEventListener(DOCUMENT_TYPE_FIELD_VISIBILITY_UPDATED, this.#onPageVisibilityChanged);
    super.disconnectedCallback();
  }

  #onBlockVisibilityChanged = (event: Event) => {
    const detail = (event as CustomEvent<BlockElementTypeVisibilityUpdatedDetail>).detail;
    if (detail?.contentElementTypeKey) {
      this._blockTypes = this.#patchBlockTypesFromSave(detail);
      this._blockTags = loadBlockFieldVisibilityTags(this._blockTypes);
    }
    void this.#reloadBlockTypesAndTags();
  };

  #patchBlockTypesFromSave(detail: BlockElementTypeVisibilityUpdatedDetail): UniqueBlockTypeOption[] {
    const fieldVisibility = { ...detail.fieldVisibility };
    const settingsFieldVisibility = { ...detail.settingsFieldVisibility };

    return this._blockTypes.map((option) => {
      if (option.contentElementTypeKey !== detail.contentElementTypeKey) {
        return option;
      }

      const scope = this._blockListScope;
      const dataTypeId = scope ? scope.split("|")[0] : undefined;

      const placements = option.placements.map((placement) => {
        if (dataTypeId && placement.blockListDataTypeUnique !== dataTypeId) {
          return placement;
        }
        return {
          ...placement,
          fieldVisibility: { ...fieldVisibility },
          settingsFieldVisibility: { ...settingsFieldVisibility },
        };
      });

      return {
        ...option,
        fieldVisibility: dataTypeId ? option.fieldVisibility : fieldVisibility,
        settingsFieldVisibility: dataTypeId ? option.settingsFieldVisibility : settingsFieldVisibility,
        placements,
      };
    });
  }

  #onPageVisibilityChanged = (event: Event) => {
    const detail = (
      event as CustomEvent<{ contentTypeUnique: string; fieldVisibility: UmbBlockFieldVisibilityMap }>
    ).detail;

    if (detail?.contentTypeUnique && detail.fieldVisibility) {
      this._pageTags = upsertPageFieldVisibilityTag(
        this._pageTags,
        this._pageTypes,
        detail.contentTypeUnique,
        detail.fieldVisibility,
      );
      return;
    }

    void this.#loadPageTags();
  };

  async #loadOptions() {
    this._loadingPageTypes = true;
    this._loadingBlockTypes = true;
    this._error = undefined;

    try {
      const [pageTypes, blockTypes] = await Promise.all([
        loadFieldVisibilityPageTypeOptions(this),
        loadAllUniqueBlockTypeOptions(this),
      ]);
      this._pageTypes = pageTypes;
      this._blockTypes = blockTypes;
      void this.#loadTags();
    } catch {
      this._error = "Could not load page types or block types.";
      this._pageTypes = [];
      this._blockTypes = [];
      this._pageTags = [];
      this._blockTags = [];
    }

    this._loadingPageTypes = false;
    this._loadingBlockTypes = false;
  }

  async #reloadBlockTypesAndTags() {
    try {
      this._blockTypes = await loadAllUniqueBlockTypeOptions(this);
      this._blockTags = loadBlockFieldVisibilityTags(this._blockTypes);
    } catch {
      this._blockTags = [];
    }
  }

  async #loadPageTags() {
    this._loadingTags = true;
    try {
      this._pageTags = await loadPageFieldVisibilityTags(this, this._pageTypes);
    } catch {
      this._pageTags = [];
    }
    this._loadingTags = false;
  }

  async #loadBlockTags() {
    this._blockTags = loadBlockFieldVisibilityTags(this._blockTypes);
  }

  async #loadTags() {
    await Promise.all([this.#loadPageTags(), this.#loadBlockTags()]);
  }

  #pageTypeOptions(): SelectOption[] {
    const options: SelectOption[] = [
      {
        name: "Choose page type…",
        value: PAGE_TYPE_PLACEHOLDER,
        selected: this._pageTypeUnique === PAGE_TYPE_PLACEHOLDER,
      },
    ];

    for (const item of this._pageTypes) {
      options.push({
        name: item.name,
        value: item.unique,
        selected: item.unique === this._pageTypeUnique,
      });
    }

    return options;
  }

  #selectedBlockType(): UniqueBlockTypeOption | undefined {
    const key = this._activeBlockConfigKey || this._blockTypeKey;
    if (!key) {
      return undefined;
    }
    return this._blockTypes.find((item) => item.contentElementTypeKey === key);
  }

  #selectedBlockVisibility() {
    const block = this.#selectedBlockType();
    if (!block) {
      return { fieldVisibility: {}, settingsFieldVisibility: {} };
    }

    const nested = getNestedPlacements(block);
    if (nested.length && this._blockListScope && this._blockListScope !== BLOCK_SCOPE_ALL) {
      return getBlockVisibilityForScope(block, this._blockListScope);
    }

    return getBlockVisibilityForScope(block, BLOCK_SCOPE_ALL);
  }

  #blockTypeOptions(): SelectOption[] {
    const options: SelectOption[] = [
      {
        name: "Choose block type…",
        value: BLOCK_TYPE_PLACEHOLDER,
        selected: this._blockTypeKey === BLOCK_TYPE_PLACEHOLDER,
      },
    ];

    for (const item of this._blockTypes) {
      options.push({
        name: item.name,
        value: item.contentElementTypeKey,
        selected: item.contentElementTypeKey === this._blockTypeKey,
      });
    }

    return options;
  }

  /** Nested items inside the selected block (e.g. Hero › Hero item), or nested placement contexts. */
  #nestedContextSelectOptions(): SelectOption[] {
    if (this._nestedContextOptions.length) {
      return this._nestedContextOptions.map((option) => ({
        name: option.name,
        value: option.value,
        selected: option.value === this._nestedContextValue,
      }));
    }

    const selected = this._blockTypes.find((item) => item.contentElementTypeKey === this._blockTypeKey);
    if (!selected) {
      return [];
    }

    return getNestedPlacements(selected).map((placement) => ({
      name: placement.label.replace(/^Nested block list:\s*/i, ""),
      value: getPlacementScopeValue(placement),
      selected: this._blockListScope === getPlacementScopeValue(placement),
    }));
  }

  async #refreshNestedContextOptions(block: UniqueBlockTypeOption | undefined) {
    if (!block) {
      this._nestedContextOptions = [];
      this._nestedContextValue = NESTED_CONTEXT_SELF;
      return;
    }

    const parentOptions = await loadNestedBlockListContextOptions(this, block.contentElementTypeKey, block.name);
    this._nestedContextOptions = parentOptions;

    if (parentOptions.length) {
      this._nestedContextValue = NESTED_CONTEXT_SELF;
      this._activeBlockConfigKey = block.contentElementTypeKey;
      this._blockListScope = BLOCK_SCOPE_ALL;
      return;
    }

    this._nestedContextValue = this._blockListScope || NESTED_CONTEXT_SELF;
  }

  #applyNestedContext(value: string) {
    this._nestedContextValue = value;

    if (this._nestedContextOptions.length) {
      const parsed = parseNestedContextValue(value);
      const parent = this._blockTypes.find((item) => item.contentElementTypeKey === this._blockTypeKey);
      if (!parent) {
        return;
      }

      if (!parsed.contentElementTypeKey) {
        this._activeBlockConfigKey = parent.contentElementTypeKey;
        this._blockListScope = BLOCK_SCOPE_ALL;
        return;
      }

      this._activeBlockConfigKey = parsed.contentElementTypeKey;
      this._blockListScope = parsed.blockListScope;
      return;
    }

    this._activeBlockConfigKey = this._blockTypeKey;
    this._blockListScope = value === NESTED_CONTEXT_SELF ? BLOCK_SCOPE_ALL : value;
  }

  #onPageTypeChange(event: Event) {
    const target = event.target as { value?: string };
    this._pageTypeUnique = target.value ?? PAGE_TYPE_PLACEHOLDER;
  }

  #onBlockTypeChange(event: Event) {
    const target = event.target as { value?: string };
    this._blockTypeKey = target.value ?? BLOCK_TYPE_PLACEHOLDER;
    this._activeBlockConfigKey = this._blockTypeKey;
    this._blockListScope = BLOCK_SCOPE_ALL;
    this._nestedContextValue = NESTED_CONTEXT_SELF;

    const block = this._blockTypes.find((item) => item.contentElementTypeKey === this._blockTypeKey);
    void this.#refreshNestedContextOptions(block);
  }

  #onNestedContextChange(event: Event) {
    const target = event.target as { value?: string };
    this.#applyNestedContext(target.value ?? NESTED_CONTEXT_SELF);
  }

  #onTagClick(tag: FieldVisibilityTag) {
    if (tag.kind === "page") {
      this._pageTypeUnique = tag.id;
      this.#scrollTo("page-type-select");
      return;
    }

    this._blockTypeKey = tag.id;
    this._activeBlockConfigKey = tag.id;
    this._blockListScope = tag.scopeValue ?? BLOCK_SCOPE_ALL;
    const block = this._blockTypes.find((item) => item.contentElementTypeKey === tag.id);
    void this.#refreshNestedContextOptions(block).then(() => {
      if (tag.scopeValue) {
        const match = this._nestedContextOptions.find((option) => {
          const parsed = parseNestedContextValue(option.value);
          return parsed.blockListScope === tag.scopeValue && parsed.contentElementTypeKey === tag.id;
        });
        if (match) {
          this.#applyNestedContext(match.value);
        } else {
          this._nestedContextValue = tag.scopeValue;
        }
      }
    });
    this.#scrollTo("block-type-select");
  }

  #scrollTo(elementId: string) {
    requestAnimationFrame(() => {
      this.shadowRoot?.getElementById(elementId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  override render() {
    const selectedBlock = this.#selectedBlockType();
    const blockVisibility = this.#selectedBlockVisibility();
    const hasPageType = !!this._pageTypeUnique;
    const loading = this._loadingPageTypes || this._loadingBlockTypes;
    const nestedContextOptions = this.#nestedContextSelectOptions();
    const showNestedContextDropdown = nestedContextOptions.length > 0;
    const nestedScopeActive = !!this._blockListScope && this._blockListScope !== BLOCK_SCOPE_ALL;

    return html`
      <div id="dashboard">
        <p class="intro uui-text">
          Use <strong>Page type</strong> for document fields. Use <strong>Block type</strong> for fields inside blocks.
          When a block has a nested Block List, use the second dropdown to choose items in that list.
        </p>

          ${this._error ? html`<p class="error">${this._error}</p>` : nothing}
          ${loading ? html`<uui-loader></uui-loader>` : nothing}

          ${!loading
            ? html`
                <uui-box headline="Page properties">
                  ${!this._loadingTags && this._pageTags.length
                    ? html`
                        <div class="tag-section">
                          <span class="tag-section-label uui-label">Page types with hide rules</span>
                          <div class="tags">
                            ${repeat(
                              this._pageTags,
                              (tag) => `page-${tag.id}`,
                              (tag) => html`
                                <button type="button" class="tag-button" @click=${() => this.#onTagClick(tag)}>
                                  <uui-tag look="default">${tag.label} (${tag.hiddenCount})</uui-tag>
                                </button>
                              `,
                            )}
                          </div>
                        </div>
                      `
                    : nothing}

                  <div class="field">
                    <uui-select
                      id="page-type-select"
                      label="Page type"
                      .options=${this.#pageTypeOptions()}
                      @change=${this.#onPageTypeChange}
                    ></uui-select>
                  </div>

                  ${!this._pageTypes.length
                    ? html`<p class="hint">No eligible page types were found.</p>`
                    : !hasPageType
                      ? html`<p class="hint">Choose a page type to configure its properties.</p>`
                      : html`
                          <umb-document-type-field-visibility-editor
                            embedded
                            document-type-unique=${this._pageTypeUnique}
                          ></umb-document-type-field-visibility-editor>
                        `}
                </uui-box>

                <uui-box headline="Block properties">
                  ${this._loadingTags ? html`<uui-loader></uui-loader>` : nothing}
                  ${!this._loadingTags && this._blockTags.length
                    ? html`
                        <div class="tag-section">
                          <span class="tag-section-label uui-label">Block lists with hide rules</span>
                          <div class="tags">
                            ${repeat(
                              this._blockTags,
                              (tag) => `${tag.id}-${tag.scopeValue ?? ""}-${tag.label}`,
                              (tag) => html`
                                <button type="button" class="tag-button" @click=${() => this.#onTagClick(tag)}>
                                  <uui-tag look="default">${tag.label} (${tag.hiddenCount})</uui-tag>
                                </button>
                              `,
                            )}
                          </div>
                        </div>
                      `
                    : nothing}

                  <div class="field">
                    <uui-select
                      id="block-type-select"
                      label="Block type"
                      .options=${this.#blockTypeOptions()}
                      @change=${this.#onBlockTypeChange}
                    ></uui-select>
                  </div>

                  ${showNestedContextDropdown
                    ? html`
                        <div class="field">
                          <uui-select
                            id="block-nested-context-select"
                            label=${this._nestedContextOptions.length ? "Nested block items" : "Nested block list"}
                            .options=${nestedContextOptions}
                            @change=${this.#onNestedContextChange}
                          ></uui-select>
                          <p class="hint scope-hint">
                            ${this._nestedContextOptions.length
                              ? "Choose this block or an item block inside its nested Block List."
                              : "This block type can appear inside another block’s nested Block List."}
                          </p>
                        </div>
                      `
                    : nothing}

                  ${!this._blockTypes.length
                    ? html`<p class="hint">No block types were found on any Block List data type.</p>`
                    : !selectedBlock
                      ? html`<p class="hint">Choose a block type to configure its fields.</p>`
                      : html`
                          <umb-block-type-field-visibility-panel
                            content-element-type-key=${selectedBlock.contentElementTypeKey}
                            block-list-scope=${nestedScopeActive ? this._blockListScope : ""}
                            .blockName=${selectedBlock.name}
                            .settingsElementTypeKey=${selectedBlock.settingsElementTypeKey}
                            .fieldVisibility=${blockVisibility.fieldVisibility}
                            .settingsFieldVisibility=${blockVisibility.settingsFieldVisibility}
                          ></umb-block-type-field-visibility-panel>
                          <p class="hint">
                            After saving, refresh the page or collapse and expand the block so the editor picks up
                            changes.
                          </p>
                        `}
                </uui-box>
              `
            : nothing}
      </div>
    `;
  }

  static override styles = [
    UmbTextStyles,
    css`
      :host {
        display: block;
        height: 100%;
        padding: var(--uui-size-layout-1);
        padding-bottom: var(--uui-size-layout-2);
        box-sizing: border-box;
        max-width: 62rem;
      }

      #dashboard {
        display: flex;
        flex-direction: column;
        gap: var(--uui-size-layout-1);
      }

      .intro {
        color: var(--uui-color-text-alt);
        margin: 0;
      }

      .error {
        color: var(--uui-color-danger);
        margin: 0;
      }

      .hint {
        color: var(--uui-color-text-alt);
        margin: var(--uui-size-space-3) 0 0;
      }

      .scope-hint {
        margin: var(--uui-size-space-2) 0 0;
      }

      uui-box {
        display: block;
      }

      .field {
        display: flex;
        flex-direction: column;
        gap: var(--uui-size-space-2);
        max-width: min(100%, 28rem);
        margin-bottom: var(--uui-size-space-4);
      }

      uui-select {
        width: 100%;
      }

      .tag-section {
        margin-bottom: var(--uui-size-space-5);
      }

      .tag-section-label {
        display: block;
        margin-bottom: var(--uui-size-space-2);
      }

      .tags {
        display: flex;
        flex-wrap: wrap;
        gap: var(--uui-size-space-2);
      }

      .tag-button {
        border: none;
        background: none;
        padding: 0;
        cursor: pointer;
        font: inherit;
      }

      .tag-button:focus-visible uui-tag {
        outline: 2px solid var(--uui-color-focus);
        outline-offset: 2px;
      }

      umb-document-type-field-visibility-editor,
      umb-block-type-field-visibility-panel {
        display: block;
        margin-top: var(--uui-size-space-5);
      }

      uui-tab-group {
        margin-bottom: var(--uui-size-space-4);
      }

      uui-loader {
        margin: var(--uui-size-space-5) 0;
      }
    `,
  ];
}

export default UmbContentFieldVisibilityDashboardElement;

declare global {
  interface HTMLElementTagNameMap {
    "umb-content-field-visibility-dashboard": UmbContentFieldVisibilityDashboardElement;
  }
}
