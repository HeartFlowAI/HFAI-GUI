# Plugins & MCP

Available in the local 0.4.0 preview. The published 0.2.4 installer does not include this screen yet.

Open **Settings → Plugins & MCP**. Built-in plugins are Aurora's file, web research, desktop control and PowerShell tool groups. Turning one off removes its tools from new agent requests. Questions and spoken replies remain available. Finish or stop a task before changing tools or connections.

## Remote MCP server

1. Enter a name and choose **Remote · Streamable HTTP**.
2. Paste the server's HTTPS MCP endpoint, such as `https://your-server.example/mcp`. HTTP is supported only for loopback addresses on this PC.
3. If needed, paste its bearer token in the dedicated token field. Do not put credentials in the URL.
4. Save, then choose **Connect**. The row shows connection status and discovered tools.

Bearer tokens are encrypted for the current Windows account. A blank token retains an existing token only when its endpoint is unchanged. Changing endpoints clears that token. To remove credentials entirely, remove the saved server and add it again.

## Installed local server

Install and configure the server following its publisher's instructions first. Aurora does not download server packages.

1. Choose **Local · standard input/output**.
2. Enter its executable, for example `node.exe`, or the full executable path.
3. Enter arguments as a JSON array, for example `["C:/path/to/server.js"]`. Use your own installed server path. Arguments are local plain text; keep credentials out of them.
4. Save, then choose **Run & connect**. This starts the executable with your Windows account's permissions.

Use an executable directly. Shells and `.cmd`, `.bat`, or `.ps1` launchers are rejected. If a server's instructions use a package runner, install its package first and use its actual executable or server script instead.

## Using tools

Connected tools join Aurora's model tool inventory. Before every external tool call, Aurora shows the server, tool, endpoint or executable, and proposed arguments. Choose **Approve once** or **Decline**; active voice mode supports the existing approval controls. A declined call is not sent to the server.

Servers start disconnected on each launch. Disconnect removes their tools and closes the client; closing Aurora also closes its managed MCP clients. Saved configurations remain for the next launch. Each server is limited to 60 tools and the app to 12 saved servers. Calls time out after 60 seconds.

This first implementation supports tools with text results through stdio and Streamable HTTP. It does not support OAuth login, legacy HTTP/SSE transport, image/audio tool results, resources, prompts, third-party plugin installation, or DeepSeek Harness's plugin packages. Built-in plugin switches are not a sandbox. See [privacy and permissions](PRIVACY.md).
