const fs = require('fs');
const path = require('path');
const dir = path.join('c:', '\\', 'Users', 'Admin', 'New folder', 'CampFind');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

files.forEach(file => {
    let content = fs.readFileSync(path.join(dir, file), 'utf8');
    if (!content.includes('href="favicon.png"')) {
        content = content.replace('</head>', '    <link rel="icon" type="image/png" href="favicon.png">\n</head>');
        fs.writeFileSync(path.join(dir, file), content, 'utf8');
        console.log('Updated ' + file);
    }
});
