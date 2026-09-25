# Block Field Visibility for Umbraco 17

**Hide page and block editor fields in the backoffice—content stays in the database.**

```powershell
dotnet add package Our.Umbraco.BlockFieldVisibility
```

Package docs: [src/Umbraco.BlockFieldVisibility/README.md](src/Umbraco.BlockFieldVisibility/README.md)

## Repo layout

- `src/Umbraco.BlockFieldVisibility/` — NuGet package (RCL + backoffice UI)
- `package/` — local test site
- `umbraco-marketplace.json` — tagline and listing details for [Umbraco Marketplace](https://marketplace.umbraco.com/)

## Run the test site

1. Set your SQL connection string in `package/appsettings.json` (see `appsettings.Example.json`).
2. `dotnet run --project package/package.csproj`
