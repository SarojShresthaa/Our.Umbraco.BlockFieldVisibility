import { UmbControllerBase } from "@umbraco-cms/backoffice/class-api";
import type { UmbControllerHost } from "@umbraco-cms/backoffice/controller-api";
import { UMB_DOCUMENT_WORKSPACE_CONTEXT } from "@umbraco-cms/backoffice/document";
import { UmbDocumentTypeDetailRepository } from "@umbraco-cms/backoffice/document-type";
import type { UmbBlockFieldVisibilityMap } from "../types.js";
import { syncDocumentHideRules } from "../utils/apply-property-view-guard-rules.js";
import {
  loadFieldVisibilityFromServer,
  resolveFieldVisibility,
} from "../utils/document-field-visibility-persistence.js";
import { DOCUMENT_TYPE_FIELD_VISIBILITY_UPDATED } from "../utils/document-type-field-visibility-storage.js";
import { scheduleVisibilityResync } from "../utils/schedule-visibility-resync.js";

class UmbDocumentFieldVisibilityWorkspaceContext extends UmbControllerBase {
  #documentTypeRepository = new UmbDocumentTypeDetailRepository(this);
  #workspace?: typeof UMB_DOCUMENT_WORKSPACE_CONTEXT.TYPE;
  #contentTypeUnique?: string;
  #pendingVisibility: UmbBlockFieldVisibilityMap = {};
  #visibilityLoaded = false;
  #workspaceLoading = true;
  #resyncTimer?: number;
  #cancelScheduledResync?: () => void;
  #syncGeneration = 0;

  #onDocumentTypeVisibilityUpdated = (event: Event) => {
    const detail = (event as CustomEvent<{ contentTypeUnique: string; fieldVisibility: UmbBlockFieldVisibilityMap }>)
      .detail;
    if (!detail?.contentTypeUnique || !this.#workspace) {
      return;
    }

    if (this.#contentTypeUnique && detail.contentTypeUnique !== this.#contentTypeUnique) {
      return;
    }

    this.#contentTypeUnique = detail.contentTypeUnique;
    this.#pendingVisibility = detail.fieldVisibility;
    this.#visibilityLoaded = true;
    void this.#reloadFromServerAndSync(this.#workspace, detail.contentTypeUnique, detail.fieldVisibility);
  };

  constructor(host: UmbControllerHost) {
    super(host);

    window.addEventListener(DOCUMENT_TYPE_FIELD_VISIBILITY_UPDATED, this.#onDocumentTypeVisibilityUpdated);

    this.consumeContext(UMB_DOCUMENT_WORKSPACE_CONTEXT, (workspace) => {
      this.#workspace = workspace;

      if (!workspace) {
        return;
      }

      this.observe(workspace.loading.isOn, (loading) => {
        this.#workspaceLoading = loading ?? false;
      });

      this.observe(workspace.contentTypeUnique, (unique) => {
        if (unique) {
          void this.#loadAndSync(workspace);
        }
      });

      this.observe(workspace.structure.contentTypeLoaded, (loaded) => {
        if (loaded) {
          void this.#loadAndSync(workspace);
        }
      });

      void workspace.structure.whenLoaded().then((loaded) => {
        if (loaded) {
          void this.#loadAndSync(workspace);
        }
      });

      this.observe(workspace.structure.contentTypeProperties, (properties) => {
        if (!properties.length || !this.#visibilityLoaded) {
          return;
        }

        this.#scheduleResync(workspace);
      });
    });
  }

  #scheduleResync(workspace: typeof UMB_DOCUMENT_WORKSPACE_CONTEXT.TYPE) {
    if (this.#resyncTimer) {
      window.clearTimeout(this.#resyncTimer);
    }

    this.#resyncTimer = window.setTimeout(() => {
      void this.#syncVisibility(workspace);
      this.#cancelScheduledResync?.();
      this.#cancelScheduledResync = scheduleVisibilityResync(() => this.#syncVisibility(workspace));
    }, 150);
  }

  async #reloadFromServerAndSync(
    workspace: typeof UMB_DOCUMENT_WORKSPACE_CONTEXT.TYPE,
    contentTypeUnique: string,
    fallback: UmbBlockFieldVisibilityMap,
  ) {
    const fromServer = await loadFieldVisibilityFromServer(this, contentTypeUnique);
    this.#pendingVisibility = fromServer ?? fallback;
    this.#visibilityLoaded = true;
    await this.#syncVisibility(workspace);
    this.#cancelScheduledResync?.();
    this.#cancelScheduledResync = scheduleVisibilityResync(() => this.#syncVisibility(workspace));
  }

  async #loadAndSync(workspace: typeof UMB_DOCUMENT_WORKSPACE_CONTEXT.TYPE) {
    const contentTypeUnique = workspace.getContentTypeUnique();
    if (!contentTypeUnique) {
      return;
    }

    this.#contentTypeUnique = contentTypeUnique;

    const { data: documentType } = await this.#documentTypeRepository.requestByUnique(contentTypeUnique);
    this.#pendingVisibility = await resolveFieldVisibility(this, contentTypeUnique, documentType);
    this.#visibilityLoaded = true;

    await this.#syncVisibility(workspace);
    this.#cancelScheduledResync?.();
    this.#cancelScheduledResync = scheduleVisibilityResync(() => this.#syncVisibility(workspace));
  }

  async #syncVisibility(workspace: typeof UMB_DOCUMENT_WORKSPACE_CONTEXT.TYPE) {
    if (!this.#visibilityLoaded || this.#workspaceLoading) {
      return;
    }

    const generation = ++this.#syncGeneration;

    try {
      await workspace.structure.whenLoaded();
    } catch {
      return;
    }

    if (generation !== this.#syncGeneration) {
      return;
    }

    await syncDocumentHideRules(workspace, this.#pendingVisibility);
  }

  override destroy() {
    if (this.#resyncTimer) {
      window.clearTimeout(this.#resyncTimer);
    }
    this.#cancelScheduledResync?.();
    window.removeEventListener(DOCUMENT_TYPE_FIELD_VISIBILITY_UPDATED, this.#onDocumentTypeVisibilityUpdated);
    super.destroy();
  }
}

export { UmbDocumentFieldVisibilityWorkspaceContext as api };
