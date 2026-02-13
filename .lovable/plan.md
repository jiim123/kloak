

## Fix CSP to Allow Agora WebSocket on Non-Standard Ports

### Problem
Agora's SDK connects to WebSocket endpoints on port **4713** (e.g., `wss://23-236-99-150.edge.agora.io:4713/`). The current Content Security Policy in `index.html` specifies `wss://*.edge.agora.io` which only matches the default WSS port (443). This blocks the connection, preventing voice activity.

### Solution
Update the `connect-src` directive in `index.html` to add `:*` (any port) to all Agora and SD-RTN domains.

### File: `index.html`

Change the following CSP `connect-src` entries:

| Current | Updated |
|---------|---------|
| `https://*.agora.io` | `https://*.agora.io:*` |
| `wss://*.agora.io` | `wss://*.agora.io:*` |
| `https://*.sd-rtn.com` | `https://*.sd-rtn.com:*` |
| `wss://*.sd-rtn.com` | `wss://*.sd-rtn.com:*` |
| `https://*.edge.agora.io` | `https://*.edge.agora.io:*` |

This is a single-line change in the CSP meta tag. No other files need modification.

