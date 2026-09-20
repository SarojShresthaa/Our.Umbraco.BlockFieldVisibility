/** Block List modal routes include `/{propertyAlias}/block/edit/...`. */
export function getBlockListPropertyAliasFromRoute(): string | undefined {
  const path = window.location.pathname;
  const blockSegment = "/block/";
  const blockIndex = path.indexOf(blockSegment);
  if (blockIndex === -1) {
    return undefined;
  }

  const beforeBlock = path.slice(0, blockIndex).replace(/\/$/, "");
  const segments = beforeBlock.split("/").filter(Boolean);
  const alias = segments.at(-1);
  return alias && alias.length > 0 ? alias : undefined;
}
