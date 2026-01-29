#!/usr/bin/env python3

# Read the entire file
with open('components/ProjectManagementTabs.tsx', 'r') as f:
    content = f.read()

# Replace the entire tabs array
old_tabs = """  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'budget', label: 'Budget', icon: 'account-balance-wallet' },
    { id: 'timeline', label: 'Timeline', icon: 'schedule' },
    { id: 'tasks', label: 'Tasks', icon: 'assignment' },
    { id: 'files', label: 'Files', icon: 'folder' },
    { id: 'messages', label: 'Messages', icon: 'message' },
  ] as const;"""

new_tabs = """  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'budget', label: 'Budget', icon: 'account-balance-wallet' },
    { id: 'timeline', label: 'Timeline', icon: 'schedule' },
    { id: 'tasks', label: 'Tasks', icon: 'assignment' },
    { id: 'messages', label: 'Messages', icon: 'message' },
  ] as const;"""

# Replace the tabs array
if old_tabs in content:
    content = content.replace(old_tabs, new_tabs)
    print("✅ Replaced tabs array")
else:
    print("❌ Could not find tabs array to replace")

# Also remove 'files' from type definition
content = content.replace("'files' |", "")

# Write back
with open('components/ProjectManagementTabs.tsx', 'w') as f:
    f.write(content)

print("✅ Fixed ProjectManagementTabs.tsx")
