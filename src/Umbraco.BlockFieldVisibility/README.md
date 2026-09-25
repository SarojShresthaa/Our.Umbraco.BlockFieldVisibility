# Block Field Visibility

**Hide document and block properties in the Umbraco 17 backoffice—without changing stored content.**

## Install

```powershell
dotnet add package Our.Umbraco.BlockFieldVisibility
```

Requires Umbraco **17.x** and **net10.0**. Works with the default template (`AddComposers()`).

NuGet ID: **`Our.Umbraco.BlockFieldVisibility`** (plugin folder: `App_Plugins/Umbraco.BlockFieldVisibility`).

## Use it

1. In **Content**, open **Field visibility**.
2. Pick a **page type** or **block type** and turn on **Hide** for properties you do not want editors to see.
3. For blocks inside a nested Block List, use **Nested block items** when it appears.

You can also open **Field visibility** on a **Block List** data type under **Settings**.

If rules change while an editor is open, refresh the page or collapse and expand the block.

## Where rules are saved

- **Pages** — JSON under `App_Data/Umbraco.BlockFieldVisibility/`
- **Blocks** — on the Block List data type configuration

## License

MIT — see [LICENSE](LICENSE).
