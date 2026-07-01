#!/usr/bin/env pwsh
# Helper: call Unity MCP tools
param(
    [Parameter(Mandatory=$true)][string]$Tool,
    [hashtable]$Args = @{},
    [int]$TimeoutSec = 30
)

$baseUrl = "http://127.0.0.1:8080/mcp"

# Initialize session
$h = @{"Accept"="application/json, text/event-stream"; "Content-Type"="application/json"}
$init = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"opencode","version":"1.0"}}}'
$resp = Invoke-WebRequest -Uri $baseUrl -Method Post -Headers $h -Body $init -UseBasicParsing -TimeoutSec 5
$sid = $resp.Headers["Mcp-Session-Id"]
$h["Mcp-Session-Id"] = $sid

# Call tool
$call = @{
    jsonrpc = "2.0"
    id = 2
    method = "tools/call"
    params = @{
        name = $Tool
        arguments = $Args
    }
} | ConvertTo-Json -Depth 10

$resp2 = Invoke-WebRequest -Uri $baseUrl -Method Post -Headers $h -Body $call -UseBasicParsing -TimeoutSec $TimeoutSec
$raw = $resp2.Content -replace "^event:.*`n", "" -replace "^data: ", ""
try { $raw | ConvertFrom-Json | ConvertTo-Json -Depth 10 } catch { $raw }
