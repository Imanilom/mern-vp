const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'features', 'RemainingViews.tsx');
const content = fs.readFileSync(filePath, 'utf8');

// The file has imports at the top, followed by components separated by // ====================
const importBlockEnd = content.indexOf('// ====================');
const imports = content.substring(0, importBlockEnd).trim();

const restOfFile = content.substring(importBlockEnd);

const parts = restOfFile.split('// ====================').map(p => p.trim()).filter(p => p);

const components = [];

parts.forEach(part => {
  const match = part.match(/export const (\w+)(?:<React\.FC|<AnalyticsProps|: React\.FC)/);
  if (match) {
    const componentName = match[1];
    components.push({ name: componentName, code: part });
  } else {
    // try fallback
    const fallbackMatch = part.match(/export const (\w+) =/);
    if (fallbackMatch) {
      components.push({ name: fallbackMatch[1], code: part });
    }
  }
});

console.log('Found components:', components.map(c => c.name));

components.forEach(comp => {
  const newFilePath = path.join(__dirname, 'src', 'features', `${comp.name}.tsx`);
  let codeToSave = imports + '\n\n' + comp.code + '\n';
  
  // Fix bug in Preprocessing
  if (comp.name === 'Preprocessing') {
    codeToSave = codeToSave.replace(/job1Status/g, 'job.status');
    codeToSave = codeToSave.replace(/job1Progress/g, 'job.progress');
    codeToSave = codeToSave.replace(/job2Status/g, 'job.status');
    codeToSave = codeToSave.replace(/job2Progress/g, 'job.progress');
  }

  fs.writeFileSync(newFilePath, codeToSave);
  console.log(`Created ${newFilePath}`);
});
