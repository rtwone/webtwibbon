const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'public', 'uploads', 'twibbon-pkkmb.png');
const fileBuffer = fs.readFileSync(filePath);
const form = new FormData();
form.append('name', 'Test Upload');
form.append('description', 'desc');
form.append('slug', 'test-upload');
form.append('width', '1080');
form.append('height', '1080');
form.append('image', new Blob([fileBuffer], { type: 'image/png' }), 'twibbon-pkkmb.png');

fetch('http://localhost:3000/api/templates/upload', {
    method: 'POST',
    body: form,
})
    .then(async (res) => {
        const text = await res.text();
        console.log('STATUS', res.status);
        console.log(text);
    })
    .catch((err) => {
        console.error('FETCH_ERROR', err);
        process.exit(1);
    });
