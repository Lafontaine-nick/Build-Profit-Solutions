#!/bin/bash

# Fix the ProjectManagementTabs.tsx file
sed -i '' 's/onProjectUpdate?: (project: Project) => void;/onProjectUpdate?: (project: Project) => void;\n}/' components/ProjectManagementTabs.tsx

# Fix the callback functions - add missing closing braces
sed -i '' 's/console\.log('\''Budget updated:'\''\, budget);$/console.log('\''Budget updated:'\''\, budget);\n            }}/' components/ProjectManagementTabs.tsx

sed -i '' 's/console\.log('\''Timeline updated:'\''\, phases);$/console.log('\''Timeline updated:'\''\, phases);\n            }}/' components/ProjectManagementTabs.tsx

# Remove the extra closing brace that's breaking the function
sed -i '' '/^}$/N; /^}\n^$/d' components/ProjectManagementTabs.tsx

echo "Fixed syntax errors in ProjectManagementTabs.tsx"
