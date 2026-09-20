namespace Umbraco.BlockFieldVisibility.Services;

public interface IDocumentFieldVisibilityStore
{
    IReadOnlyDictionary<string, bool> Get(Guid documentTypeId);

    void Set(Guid documentTypeId, IReadOnlyDictionary<string, bool> fieldVisibility);
}
