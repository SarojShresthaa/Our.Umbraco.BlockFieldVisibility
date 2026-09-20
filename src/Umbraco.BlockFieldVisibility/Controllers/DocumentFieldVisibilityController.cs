using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Umbraco.BlockFieldVisibility.Services;
using Umbraco.Cms.Api.Management.Controllers;
using Umbraco.Cms.Api.Management.Routing;
using Umbraco.Cms.Web.Common.Authorization;

namespace Umbraco.BlockFieldVisibility.Controllers;

[VersionedApiBackOfficeRoute("block-field-visibility")]
[Authorize(Policy = AuthorizationPolicies.BackOfficeAccess)]
public class DocumentFieldVisibilityController : ManagementApiControllerBase{
    private readonly IDocumentFieldVisibilityStore _store;

    public DocumentFieldVisibilityController(IDocumentFieldVisibilityStore store) => _store = store;

    [HttpGet("{documentTypeId:guid}")]
    public IActionResult Get(Guid documentTypeId)
    {
        if (documentTypeId == Guid.Empty)
        {
            return BadRequest();
        }

        return Ok(_store.Get(documentTypeId));
    }

    [HttpPut("{documentTypeId:guid}")]
    public IActionResult Put(Guid documentTypeId, [FromBody] Dictionary<string, bool> fieldVisibility)
    {
        if (documentTypeId == Guid.Empty)
        {
            return BadRequest();
        }

        _store.Set(documentTypeId, fieldVisibility ?? new Dictionary<string, bool>());
        return Ok();
    }
}
