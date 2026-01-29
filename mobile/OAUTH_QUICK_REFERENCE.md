# OAuth Quick Reference Card

## ✅ Configuration Checklist

### Google Console
- [ ] OAuth 2.0 Client ID created
- [ ] Redirect URIs: Only `https://` (no `clerk://` for web apps)
  - `https://accounts.clerk.dev/v1/oauth_callback`
  - `https://[your-instance].clerk.accounts.dev/v1/oauth_callback`

### Clerk Dashboard
- [ ] Google OAuth enabled
- [ ] Client ID and Secret added
- [ ] Redirect URI includes `/v1/oauth_callback`

### App
- [ ] Clerk publishable key in `.env.local`
- [ ] App reloaded after changes

## 🔍 Quick Verification

```bash
cd mobile
node verify-oauth-setup.js
```

## 🚨 Common Issues

| Issue | Quick Fix |
|-------|-----------|
| "Session already exists" but not signed in | Check Clerk dashboard OAuth config |
| Redirected back to auth after sign-in | Fixed in `useRequireAuth` - verify it checks Clerk auth |
| "Invalid Redirect URI" (Google) | Remove `clerk://` from Google Console, use only `https://` |
| "Apple Sign-In Error" | Check Apple Developer Portal setup and Clerk credentials |
| OAuth buttons not showing | Check Clerk key is configured |
| Apple button not working | Verify Apple Developer account setup (can take 48 hours) |

## 📚 Documentation

- **Setup**: `GOOGLE_OAUTH_SETUP.md`
- **Troubleshooting**: `OAUTH_TROUBLESHOOTING.md`
- **What We Fixed**: `OAUTH_FIXES_SUMMARY.md`
- **Quick Setup**: `OAUTH_QUICK_SETUP.md`

## 🔄 If OAuth Stops Working

1. Run verification: `node verify-oauth-setup.js`
2. Check redirect URIs match exactly
3. Clear cache: `npx expo start -c --tunnel`
4. Check logs for "Session exists error detected"
5. See `OAUTH_TROUBLESHOOTING.md` for details

## ✨ Key Points

- ✅ Always verify actual auth state, not just error messages
- ✅ Use `https://` URIs for web OAuth clients
- ✅ `useRequireAuth` now checks Clerk auth when Clerk is enabled
- ✅ Error handling verifies user is actually signed in

