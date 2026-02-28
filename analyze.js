const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. Check JS syntax
console.log('--- Checking JS Syntax ---');
['script.js', 'supabase-client.js'].forEach(file => {
    try {
        execSync(`node -c "${path.join(__dirname, file)}"`, { stdio: 'pipe' });
        console.log(`✅ ${file} syntax OK`);
    } catch (e) {
        console.error(`❌ Syntax error in ${file}:\n${e.stderr.toString()}`);
    }
});

// 2. Simple HTML checks (missing closing tags, duplicate IDs)
console.log('\n--- Checking HTML Files ---');
const htmlFiles = fs.readdirSync(__dirname).filter(f => f.endsWith('.html'));

htmlFiles.forEach(file => {
    const content = fs.readFileSync(path.join(__dirname, file), 'utf8');

    // Check for multiple IDs
    const idRegex = /id="([^"]+)"/g;
    let match;
    const ids = new Set();
    const dupes = new Set();
    while ((match = idRegex.exec(content)) !== null) {
        if (ids.has(match[1])) {
            dupes.add(match[1]);
        }
        ids.add(match[1]);
    }
    if (dupes.size > 0) {
        console.warn(`⚠️ Duplicate IDs in ${file}: ${Array.from(dupes).join(', ')}`);
    } else {
        console.log(`✅ ${file} IDs OK`);
    }

    // Very basic check for unclosed div tags (not perfect but helpful)
    const openDivs = (content.match(/<div\b/g) || []).length;
    const closeDivs = (content.match(/<\/div>/g) || []).length;
    if (openDivs !== closeDivs) {
        console.error(`❌ Unmatched <div> tags in ${file}: ${openDivs} open, ${closeDivs} close`);
    }
});

// 3. Simple CSS checks (unbalanced brackets)
console.log('\n--- Checking CSS Syntax ---');
const cssFiles = fs.readdirSync(__dirname).filter(f => f.endsWith('.css'));
cssFiles.forEach(file => {
    const content = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const openBraces = (content.match(/\{/g) || []).length;
    const closeBraces = (content.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
        console.error(`❌ Unbalanced braces in ${file}: ${openBraces} open, ${closeBraces} close`);
    } else {
        console.log(`✅ ${file} braces OK`);
    }
});

console.log('\n--- Analysis Complete ---');
