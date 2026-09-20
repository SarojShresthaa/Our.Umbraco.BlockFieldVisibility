# Block Field Visibility for Umbraco 17

Hide **document** and **block** properties in the backoffice. Values stay in the database; only the editor UI changes.

## Package names

| What | Name |
|------|------|
| **NuGet (install this)** | `Our.Umbraco.BlockFieldVisibility` |
| **Plugin / assembly** | `Umbraco.BlockFieldVisibility` |
| **Backoffice path** | `App_Plugins/Umbraco.BlockFieldVisibility` |

`Umbraco.BlockFieldVisibility` as a NuGet ID is **reserved** on nuget.org — use **`Our.Umbraco.BlockFieldVisibility`**.

## Requirements

- Umbraco CMS **17.x**
- Target framework **net10.0** (same as this package)

## Install

```powershell
dotnet add package Our.Umbraco.BlockFieldVisibility
```

Works with the default Umbraco template (`AddComposers()`). No extra registration in `Program.cs`.

### From source (development)

1. Reference `Umbraco.BlockFieldVisibility.csproj` from your site.
2. Build — MSBuild runs `Client/npm run build` automatically.

## Configure hide rules

### Content section → **Field visibility** dashboard (recommended)

1. Go to **Content** in the backoffice.
2. Open **Field visibility** in the section navigation.
3. **Page type** — choose a document type and toggle **Hide** per property (tabs match the document type layout).
4. **Block type** — choose a block element type and toggle **Hide** on content/settings properties.
5. **Nested Block List** — if the block type contains a nested list (e.g. Hero with child items), use the **Nested block items** dropdown to configure the parent block or a specific item type in that list.

**Tags** at the top of each area list page types / block contexts that already have hide rules (with counts). Click a tag to jump to that context.

### Settings → Data Types

1. Open a **Block List** data type.
2. Use the **Field visibility** workspace view on the data type editor.

### While editing content

Rules apply when you open a document or expand a block. If you changed rules while an editor was already open, **refresh** or **collapse and expand** the block.

## Where data is saved

| Area | Storage |
|------|---------|
| Page / document type properties | `App_Data/Umbraco.BlockFieldVisibility/{documentTypeId}.json` via Management API |
| Block List block types | Data type configuration — `fieldVisibility` and `settingsFieldVisibility` on each block entry |

## Build backoffice assets (contributors)

```bash
cd Client
npm ci
npm run build
```

## License

MIT — see [LICENSE](LICENSE).
