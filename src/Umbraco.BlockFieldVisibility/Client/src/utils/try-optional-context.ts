import type { UmbContextToken } from "@umbraco-cms/backoffice/context-api";
import type { UmbControllerHost } from "@umbraco-cms/backoffice/controller-api";

type OptionalContextOptions = {
  skipHost?: boolean;
  passContextAliasMatches?: boolean;
};

export async function tryOptionalContext<T>(
  host: UmbControllerHost,
  token: UmbContextToken<unknown, unknown, T>,
  options: OptionalContextOptions = { skipHost: true },
): Promise<T | undefined> {
  try {
    return await host.getContext(token, options);
  } catch {
    return undefined;
  }
}

/** Walk ancestors and skip intermediate workspaces (e.g. block) that share `UmbWorkspaceContext`. */
export async function tryOptionalAncestorContext<T>(
  host: UmbControllerHost,
  token: UmbContextToken<unknown, unknown, T>,
): Promise<T | undefined> {
  return tryOptionalContext(host, token, {
    skipHost: true,
    passContextAliasMatches: true,
  });
}
