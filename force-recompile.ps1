$h = @{"Accept"="application/json, text/event-stream"; "Content-Type"="application/json"}
$init = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"opencode","version":"1.0"}}}'
$resp = Invoke-WebRequest -Uri "http://127.0.0.1:8080/mcp" -Method Post -Headers $h -Body $init -UseBasicParsing -TimeoutSec 5
$sid = $resp.Headers["Mcp-Session-Id"]
$h["Mcp-Session-Id"] = $sid

$body = @{
    jsonrpc = "2.0"
    id = 2
    method = "tools/call"
    params = @{
        name = "execute_code"
        arguments = @{
            action = "execute"
            code = 'UnityEditor.AssetDatabase.Refresh(); return "Refreshed";'
        }
    }
} | ConvertTo-Json -Depth 10

$resp2 = Invoke-WebRequest -Uri "http://127.0.0.1:8080/mcp" -Method Post -Headers $h -Body $body -UseBasicParsing -TimeoutSec 60
$raw = $resp2.Content -replace "^event:.*`n", "" -replace "^data: ", ""
try { $raw | ConvertFrom-Json | ConvertTo-Json -Depth 10 } catch { $raw }
