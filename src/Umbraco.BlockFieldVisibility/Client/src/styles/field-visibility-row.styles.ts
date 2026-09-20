import { css } from "@umbraco-cms/backoffice/external/lit";

/** Shared property row layout aligned with backoffice property editors. */
export const UmbFieldVisibilityRowStyles = css`
  .field-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--uui-size-space-4);
    padding: var(--uui-size-space-4) 0;
    border-bottom: 1px solid var(--uui-color-divider);
  }

  .field-row:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .field-row:first-child {
    padding-top: 0;
  }

  .field-label {
    display: flex;
    flex-direction: column;
    gap: var(--uui-size-space-1);
    min-width: 0;
    flex: 1;
  }

  .field-name {
    font-weight: 700;
  }

  .field-alias {
    font-size: var(--uui-type-small-size, 0.85em);
    color: var(--uui-color-text-alt);
  }

  .help-text {
    margin: 0 0 var(--uui-size-layout-1);
    color: var(--uui-color-text-alt);
  }

  .status-text {
    margin: 0 0 var(--uui-size-space-3);
    color: var(--uui-color-text-alt);
    font-size: var(--uui-type-small-size, 0.9em);
  }

  .error-text {
    margin: 0 0 var(--uui-size-space-3);
    color: var(--uui-color-danger);
  }
`;
