import type { UmbControllerHost } from "@umbraco-cms/backoffice/controller-api";
import { UMB_NOTIFICATION_CONTEXT } from "@umbraco-cms/backoffice/notification";

export async function notifyFieldVisibilitySaved(
  host: UmbControllerHost,
  label: string,
  hide: boolean,
) {
  const notificationContext = await host.getContext(UMB_NOTIFICATION_CONTEXT);
  if (!notificationContext) {
    return;
  }

  const message = hide
    ? `${label} is now hidden in the backoffice Content editor.`
    : `${label} is visible again in the backoffice Content editor.`;

  notificationContext.peek("positive", { data: { message } });
}

export async function notifyFieldVisibilitySaveFailed(host: UmbControllerHost, message: string) {
  const notificationContext = await host.getContext(UMB_NOTIFICATION_CONTEXT);
  if (!notificationContext) {
    return;
  }

  notificationContext.peek("danger", { data: { message } });
}

export async function notifyFieldVisibilityBatchSaved(
  host: UmbControllerHost,
  message: string,
  tone: "positive" | "warning" | "danger" = "positive",
) {
  const notificationContext = await host.getContext(UMB_NOTIFICATION_CONTEXT);
  if (!notificationContext) {
    return;
  }

  notificationContext.peek(tone, { data: { message } });
}
