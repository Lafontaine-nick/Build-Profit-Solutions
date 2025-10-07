const fs = require('fs');

const filePath = 'src/services/leadStorage.js';
const content = fs.readFileSync(filePath, 'utf8');

const fixedContent = content.replace(
  "const { v4: uuidv4 } = require('uuid');",
  `const { v4: uuidv4 } = require('uuid');

// In-memory storage for leads (in production, use a database)
let leads = [];`
);

fs.writeFileSync(filePath, fixedContent);
console.log('Fixed leads storage declaration');
