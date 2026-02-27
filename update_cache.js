const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));
const version = Date.now();
for (const f of files) {
    let content = fs.readFileSync(f, 'utf8');
    content = content.replace(/styles\.css(\?v=\d+)?/g, 'styles.css?v=' + version);
    fs.writeFileSync(f, content);
}
console.log('Cache buster updated to v=' + version);
