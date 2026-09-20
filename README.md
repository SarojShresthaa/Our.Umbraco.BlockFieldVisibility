# Block Field Visibility for Umbraco 17

Community package source for **Our.Umbraco.BlockFieldVisibility**.

| | |
|--|--|
| **NuGet install** | `dotnet add package Our.Umbraco.BlockFieldVisibility` |
| **Plugin folder** | `App_Plugins/Umbraco.BlockFieldVisibility` |
| **Full documentation** | [src/Umbraco.BlockFieldVisibility/README.md](src/Umbraco.BlockFieldVisibility/README.md) |

## Repository layout

- `src/Umbraco.BlockFieldVisibility/` — RCL package (C# + backoffice Client)
- `package/` — sample Umbraco site for local testing
- `scripts/publish-nuget.ps1` — pack and push helper

## Quick start (local test site)

```bash
dotnet build package/package.csproj
```

## Publish NuGet

See [src/Umbraco.BlockFieldVisibility/README.md](src/Umbraco.BlockFieldVisibility/README.md) and `scripts/publish-nuget.ps1`.

## Run the test site locally

1. Copy `package/appsettings.Example.json` settings into `package/appsettings.json` (or set your SQL connection string).
2. `dotnet run --project package/package.csproj`

## GitHub

After creating an empty repo on GitHub, from this folder:

```powershell
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```
