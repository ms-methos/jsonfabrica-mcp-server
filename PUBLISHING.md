# Publishing

## npm

```bash
npm run build
npm publish --access public
```

The package is public under the `@jsonfabrica` scope on npmjs.org.

## MCP Registry

The [MCP Registry](https://registry.modelcontextprotocol.io) is the canonical
discovery surface for MCP servers. It hosts **metadata only** — the npm package
must be published first, and its `package.json` must carry an `mcpName` field
matching `server.json`'s `name` (already set to
`io.github.ms-methos/jsonfabrica-mcp-server`).

### One-time setup

Install the publisher CLI (Windows PowerShell):

```powershell
$arch = if ([System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture -eq "Arm64") { "arm64" } else { "amd64" }
Invoke-WebRequest -Uri "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_windows_$arch.tar.gz" -OutFile "mcp-publisher.tar.gz"
tar xf mcp-publisher.tar.gz mcp-publisher.exe
rm mcp-publisher.tar.gz
# move mcp-publisher.exe somewhere on PATH
```

(macOS/Linux: `brew install mcp-publisher`.)

### Each release

1. Bump `version` in **both** `package.json` and `server.json` (top-level and
   `packages[0].version`) to the same value.
2. `npm run build && npm publish --access public`
3. Verify the published `package.json` shows the new version and still has
   `"mcpName": "io.github.ms-methos/jsonfabrica-mcp-server"`.
4. Publish the registry metadata:
   ```bash
   mcp-publisher validate      # optional, checks server.json
   mcp-publisher login github  # opens a browser; authorises the io.github.ms-methos namespace
   mcp-publisher publish
   ```
5. Confirm at `https://registry.modelcontextprotocol.io/v0/servers?search=jsonfabrica`.

`mcp-publisher login github` proves you control the `ms-methos` GitHub account,
which is what authorises publishing under the `io.github.ms-methos/*` namespace.

### Namespace note

`io.github.ms-methos/jsonfabrica-mcp-server` is used because it verifies via
GitHub auth with zero extra setup. A `com.jsonfabrica/mcp-server` namespace is
also possible but requires a DNS TXT record on `jsonfabrica.com` and the
`--auth dns` flow — switch later if brand-consistent naming is worth it.
