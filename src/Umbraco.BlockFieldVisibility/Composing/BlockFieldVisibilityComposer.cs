using Microsoft.Extensions.DependencyInjection;
using Umbraco.BlockFieldVisibility.Services;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;

namespace Umbraco.BlockFieldVisibility.Composing;

public class BlockFieldVisibilityComposer : IComposer
{
    public void Compose(IUmbracoBuilder builder)
    {
        builder.Services.AddSingleton<IDocumentFieldVisibilityStore, JsonFileDocumentFieldVisibilityStore>();
    }
}
