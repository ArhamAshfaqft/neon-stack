param(
    [string]$Method,
    [string]$Tool,
    [hashtable]$Arguments = @{},
    [string]$SessionId = ""
)

$baseUrl = "http://127.0.0.1:8080/mcp"
$headers = @{
    "Accept" = "application/json, text/event-stream"
    "Content-Type" = "application/json"
}
if ($SessionId) { $headers["Mcp-Session-Id"] = $SessionId }

if ($Method -eq "initialize") {
    $body = @{
        jsonrpc = "2.0"
        id = 1
        method = "initialize"
        params = @{
            protocolVersion = "2024-11-05"
            capabilities = @{}
            clientInfo = @{ name = "opencode"; version = "1.0" }
        }
    } | ConvertTo-Json -Depth 10
} elseif ($Method -eq "call") {
    $body = @{
        jsonrpc = "2.0"
        id = [int](Get-Date -UFormat %s)
        method = "tools/call"
        params = @{
            name = $Tool
            arguments = $Arguments
        }
    } | ConvertTo-Json -Depth 10
}

$resp = Invoke-WebRequest -Uri $baseUrl -Method Post -Headers $headers -Body $body -UseBasicParsing
if (-not $SessionId) {
    $sid = $resp.Headers["Mcp-Session-Id"]
    Write-Output "SESSION_ID=$sid"
}
$content = $resp.Content -replace "^event:.*`n", "" -replace "^data: ", ""
try { $content | ConvertFrom-Json | ConvertTo-Json -Depth 10 } catch { $content }
