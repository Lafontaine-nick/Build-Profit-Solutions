#!/usr/bin/env python3

# Read the file
with open('components/ProjectManagementTabs.tsx', 'r') as f:
    content = f.read()

# Use regex to remove the files tab line
import re
content = re.sub(r'\s*\{ id: \'files\', label: \'Files\', icon: \'folder\' \},\n', '', content)

# Remove 'files' from type definition
content = content.replace("'files' |", "")

# Write back
with open('components/ProjectManagementTabs.tsx', 'w') as f:
    f.write(content)

print("✅ Fixed ProjectManagementTabs.tsx with regex")
