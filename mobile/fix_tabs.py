#!/usr/bin/env python3

# Fix ProjectManagementTabs.tsx - remove files tab
with open('components/ProjectManagementTabs.tsx', 'r') as f:
    content = f.read()

# Remove the files tab line
content = content.replace("    { id: 'files', label: 'Files', icon: 'folder' },", "")

# Remove 'files' from the type definition
content = content.replace("'files' |", "")

# Write back
with open('components/ProjectManagementTabs.tsx', 'w') as f:
    f.write(content)

print("✅ Removed files tab from ProjectManagementTabs.tsx")
