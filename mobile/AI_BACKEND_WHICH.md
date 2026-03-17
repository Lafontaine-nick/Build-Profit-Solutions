# Which backend does the AI Assistant hit?

## Why it feels confusing

The app can talk to **two** backends:

1. **Local** – your Mac (`http://localhost:3001` or `http://YOUR_MAC_IP:3001`)
2. **Production** – Render (`https://build-profit-solutions-backend.onrender.com`)

Your **profit-margin short answer** and other recent fixes live in **your local backend**. If the app is using the **production** URL, it will never hit that code, so you keep seeing the old long response.

---

## How the app chooses the URL

In `AIAssistantModal.tsx`, `resolveAIBaseUrl()` decides the base URL in this order:

| Priority | When | Result |
|----------|------|--------|
| 1 | `EXPO_PUBLIC_AI_API_URL` is set (in `.env.local` or env) | Uses that URL (e.g. `http://192.168.0.201:3001`) |
| 2 | iOS Simulator | `http://localhost:3001` |
| 3 | Web | `http://localhost:3001` |
| 4 | Android Emulator | `http://10.0.2.2:3001` |
| 5 | `EXPO_PUBLIC_API_BASE_URL` is set | Uses that base (e.g. production or your Mac IP) |
| 6 | Physical device + Expo gives a `hostUri` (e.g. dev server IP) | Uses `http://THAT_IP:3001` |
| 7 | Fallback | `http://localhost:3001` (only works on simulator/web) |

Important: **If you have no `.env.local`**, `app.config.js` loads `env.production`, which sets  
`EXPO_PUBLIC_API_BASE_URL=https://build-profit-solutions-backend.onrender.com`.  
So on a **physical device**, the AI Assistant often ends up using **production** unless you override it.

---

## How to make the AI Assistant hit your local backend

### Option A – Prefer for AI (recommended)

Set the **AI-specific** URL so only the AI uses your Mac; rest of the app can keep using production if you want.

In `mobile/.env.local` (create it if needed):

```bash
# AI Assistant talks to your Mac
EXPO_PUBLIC_AI_API_URL=http://YOUR_MAC_IP:3001
```

Replace `YOUR_MAC_IP` with your Mac’s LAN IP (e.g. `192.168.0.201`). Find it: System Settings → Network, or run `ipconfig getifaddr en0` in Terminal.

Then restart the Expo dev server and reload the app.

### Option B – All API calls to local backend

Point the whole app at your Mac:

In `mobile/.env.local`:

```bash
EXPO_PUBLIC_API_BASE_URL=http://YOUR_MAC_IP:3001/api
```

Again use your Mac’s LAN IP. Restart Expo and reload.

---

## How to confirm which backend you’re hitting

1. **In the app (dev only)**  
   When running in development, the AI Assistant modal header shows a small “Backend: …” line (e.g. “Backend: Local (192.168.0.201:3001)” or “Backend: Production”). That’s the base URL used for AI.

2. **In the terminal**  
   When you send a message, the app logs something like:  
   `🤖 AI Assistant connecting to: http://192.168.0.201:3001/api/ai-assistant`  
   or  
   `🤖 AI Assistant connecting to: https://build-profit-solutions-backend.onrender.com/api/ai-assistant`

3. **Backend**  
   When a request hits your local server, you’ll see the request in the terminal where you ran `npm start` (or similar) in `backend/`.

---

## Checklist if “it’s not hitting the backend”

- [ ] Created `mobile/.env.local` (not just `.env.local.bak`).
- [ ] Set `EXPO_PUBLIC_AI_API_URL=http://YOUR_MAC_IP:3001` (or `EXPO_PUBLIC_API_BASE_URL=...`) with your real Mac IP.
- [ ] Restarted the Expo dev server after changing env (env is read at start).
- [ ] Reloaded the app (e.g. shake → Reload, or save a file if fast refresh is on).
- [ ] If using a physical device: phone and Mac on the same Wi‑Fi; backend running on the Mac (`cd backend && npm start`).
- [ ] Check the “Backend: …” line in the AI modal (in dev) or the `🤖 AI Assistant connecting to:` log to confirm the URL.

Once the app is using your Mac’s URL, the AI Assistant will hit your local backend and you’ll get the short profit-margin answer and any other local changes.
