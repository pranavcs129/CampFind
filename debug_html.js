const fs = require('fs');

const html = fs.readFileSync('dashboard.html', 'utf8');
const lines = html.split('\n');
let divCount = 0;

for (let i = 0; i < lines.length; i++) {
    const openMatches = (lines[i].match(/<div\b/g) || []).length;
    const closeMatches = (lines[i].match(/<\/div>/g) || []).length;
    divCount += (openMatches - closeMatches);
    if (divCount < 0) {
        console.log(`Extra closing div at line ${i + 1}`);
        divCount = 0; // reset to avoid cascading
    }
}
console.log(`Final open divs: ${divCount}`);

// Find duplicate IDs
const ids = {};
const idRegex = /id="([^"]+)"/g;
let match;
while ((match = idRegex.exec(html)) !== null) {
    const id = match[1];
    if (ids[id]) {
        ids[id].push(html.substring(0, match.index).split('\n').length);
    } else {
        ids[id] = [html.substring(0, match.index).split('\n').length];
    }
}
for (const [id, lines] of Object.entries(ids)) {
    if (lines.length > 1) {
        console.log(`Duplicate ID: ${id} at lines ${lines.join(', ')}`);
    }
}
