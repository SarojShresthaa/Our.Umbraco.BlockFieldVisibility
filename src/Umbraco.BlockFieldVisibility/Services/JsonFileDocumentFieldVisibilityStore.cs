using System.Text.Json;
using Microsoft.Extensions.Hosting;

namespace Umbraco.BlockFieldVisibility.Services;

public sealed class JsonFileDocumentFieldVisibilityStore : IDocumentFieldVisibilityStore
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

    private readonly string _folder;

    public JsonFileDocumentFieldVisibilityStore(IHostEnvironment hostEnvironment)
    {
        _folder = Path.Combine(hostEnvironment.ContentRootPath, "App_Data", "Umbraco.BlockFieldVisibility");
        Directory.CreateDirectory(_folder);
    }

    public IReadOnlyDictionary<string, bool> Get(Guid documentTypeId)
    {
        var path = GetPath(documentTypeId);
        if (!File.Exists(path))
        {
            return new Dictionary<string, bool>();
        }

        try
        {
            var json = File.ReadAllText(path);
            var map = JsonSerializer.Deserialize<Dictionary<string, bool>>(json, JsonOptions);
            return map ?? new Dictionary<string, bool>();
        }
        catch
        {
            return new Dictionary<string, bool>();
        }
    }

    public void Set(Guid documentTypeId, IReadOnlyDictionary<string, bool> fieldVisibility)
    {
        var path = GetPath(documentTypeId);
        var payload = fieldVisibility ?? new Dictionary<string, bool>();
        File.WriteAllText(path, JsonSerializer.Serialize(payload, JsonOptions));
    }

    private string GetPath(Guid documentTypeId) => Path.Combine(_folder, $"{documentTypeId:N}.json");
}
