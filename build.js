const fs = require('fs');
const path = require('path');

const files = [
  'data.js',
  'sound.js',
  'state.js',
  'particles.js',
  'renderer.js',
  'simulation.js',
  'ui.js',
  'settings.js',
  'main.js'
];

let bundle = '(() => {\n"use strict";\n';

for (const f of files) {
  const filePath = path.join(__dirname, 'js', f);
  let content = fs.readFileSync(filePath, 'utf8');

  // Strip multi-line and single-line imports
  content = content.replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?/gm, '');
  content = content.replace(/^import\s+['"][^'"]+['"];?/gm, '');

  // Strip export { ... }
  content = content.replace(/^export\s*\{[\s\S]*?\};?/gm, '');
  content = content.replace(/^export\s+default\s+[^;]+;?/gm, '');

  // Strip export keyword before declarations
  content = content.replace(/^export\s+(const|let|var|function|class)\s+/gm, '$1 ');

  bundle += `\n/* ==================== ${f} ==================== */\n` + content + '\n';
}

bundle += '\n})();\n';

fs.writeFileSync(path.join(__dirname, 'js', 'bundle.js'), bundle, 'utf8');
console.log('Successfully generated js/bundle.js (size: ' + bundle.length + ' bytes)');
