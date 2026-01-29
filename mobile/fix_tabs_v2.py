#!/usr/bin/env python3

# Read the file line by line
with open('components/ProjectManagementTabs.tsx', 'r') as f:
    lines = f.readlines()

# Process each line
new_lines = []
for line in lines:
    # Skip the files tab line
    if "{ id: 'files', label: 'Files', icon: 'folder' }," in line:
        print(f"Skipping line: {line.strip()}")
        continue
    # Remove 'files' from type definition
    elif "'files' |" in line:
        new_line = line.replace("'files' |", "")
        print(f"Modified type line: {new_line.strip()}")
        new_lines.append(new_line)
    else:
        new_lines.append(line)

# Write back
with open('components/ProjectManagementTabs.tsx', 'w') as f:
    f.writelines(new_lines)

print("✅ Fixed ProjectManagementTabs.tsx")
