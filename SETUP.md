# LACRM MCP Server Setup

This server gives Claude access to Less Annoying CRM (88 tools). It runs on Railway. It wraps the `lacrm-mcp` npm package.

## Two different secrets

| Variable | Who makes it | What it does |
|---|---|---|
| `LACRM_API_KEY` | LACRM | Lets the server talk to your CRM |
| `MCP_AUTH_TOKEN` | You (any random string, 16+ characters) | Locks the server URL so only you can use it |

Do not mix them up. Set both.

## Steps

1. In LACRM, go to Settings, then Programmer API. Create an API key. Copy it.
2. In Railway, create a new project from this GitHub repo.
3. Open the service. Go to Variables. Add:
   - `LACRM_API_KEY` = the key from step 1
   - `MCP_AUTH_TOKEN` = a random string you make
4. Go to Settings, then Networking. Click Generate Domain.
5. Wait for the deploy to show Active.
6. Open `https://[your-app].up.railway.app/health`. It must show `ok`.
7. Check the lock. Open `https://[your-app].up.railway.app/mcp`. It must show `Forbidden`.
8. In Claude, go to Settings, then Connectors. Add a custom connector. Use this URL:

   `https://[your-app].up.railway.app/mcp?key=[your MCP_AUTH_TOKEN]`

## Test prompt

Start a new chat. Type: `Run get_pipelines in LACRM.`

You must see your pipelines.

## Rules

- Never commit a real token or API key to this repo.
- The server stops at startup if `MCP_AUTH_TOKEN` is missing or shorter than 16 characters.
- If `LACRM_API_KEY` is missing, the server starts, but every CRM call fails.
- `/health` has no key check. Railway uses it.
- Request logs are off on purpose. CRM data must not go into Railway logs.

## Notes

- LACRM limits requests. The package waits automatically at 120 requests per minute.
- Bulk CSV runs save state to the server disk. Railway disks reset on each deploy. Do not start a long bulk run and then deploy.
- To update the package, change the version in `package.json`. Then redeploy.
