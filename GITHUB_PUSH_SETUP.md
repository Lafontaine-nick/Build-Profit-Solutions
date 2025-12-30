# How to Push to GitHub with Personal Access Token

GitHub no longer accepts passwords for Git operations. You need a Personal Access Token.

## Quick Steps to Create a Token

### 1. Create a Personal Access Token on GitHub

1. Go to GitHub.com and sign in
2. Click your profile picture (top right) → **Settings**
3. Scroll down in left sidebar → **Developer settings**
4. Click **Personal access tokens** → **Tokens (classic)**
5. Click **Generate new token** → **Generate new token (classic)**
6. Give it a name: `My Development Token`
7. Select expiration: **90 days** (or No expiration if you prefer)
8. Check these permissions (scopes):
   - ✅ **repo** (Full control of private repositories)
9. Scroll down and click **Generate token**
10. **IMPORTANT:** Copy the token immediately (you won't see it again!)
   - It looks like: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 2. Use the Token to Push

When you run `git push`, use the token as your password:

```bash
cd /Users/nick_lafontaine/build-profit-solutions
git push
```

**When prompted:**
- **Username:** `nick94lafontaine@gmail.com` (or your GitHub username)
- **Password:** Paste your personal access token (the `ghp_...` token, NOT your GitHub password)

### 3. (Optional) Save Token So You Don't Enter It Every Time

You can configure Git to remember your credentials:

**macOS Keychain:**
```bash
git config --global credential.helper osxkeychain
```

Then when you push next time, it will save the token in your macOS keychain.

---

## Alternative: Use SSH Instead of HTTPS

If you prefer not to use tokens, you can set up SSH:

### 1. Generate SSH Key
```bash
ssh-keygen -t ed25519 -C "nick94lafontaine@gmail.com"
```
(Press Enter to accept defaults)

### 2. Copy Your Public Key
```bash
cat ~/.ssh/id_ed25519.pub
```
Copy the entire output (starts with `ssh-ed25519...`)

### 3. Add to GitHub
1. Go to GitHub.com → Settings → SSH and GPG keys
2. Click **New SSH key**
3. Paste your public key
4. Click **Add SSH key**

### 4. Change Remote URL to SSH
```bash
cd /Users/nick_lafontaine/build-profit-solutions
git remote set-url origin git@github.com:Lafontaine-nick/Build-Profit-Solutions.git
```

Now `git push` will use SSH instead of HTTPS.

---

## Quick Fix for Right Now

**Easiest option:** Just create the token and use it when pushing:

1. Create token: https://github.com/settings/tokens (generate new token, check "repo" scope)
2. Copy the token (`ghp_...`)
3. Run `git push` and paste the token as password when asked

