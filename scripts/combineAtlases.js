/**
 * Combines all individual atlas JSONs in sprites/ into a single sprites/atlases.json.
 *
 * Run after re-exporting atlases from TexturePacker (which drops per-atlas JSONs
 * back into sprites/):
 *   node scripts/combineAtlases.js
 *
 * The individual JSONs are removed once merged, keeping the project at a single
 * atlas data file.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SPRITES_DIR = path.join(ROOT, 'sprites');
const OUT = path.join(SPRITES_DIR, 'atlases.json');

function combineAtlases(outPath = OUT) {
    const files = fs.readdirSync(SPRITES_DIR)
        .filter((f) => f.endsWith('.json') && f !== 'atlases.json')
        .sort();
    if (!files.length) {
        console.log('No individual atlas JSONs found in sprites/ (nothing to combine).');
        return false;
    }

    const combined = {};
    for (const file of files) {
        const key = file.replace(/\.json$/, '');
        combined[key] = JSON.parse(fs.readFileSync(path.join(SPRITES_DIR, file), 'utf8'));
    }

    fs.writeFileSync(outPath, JSON.stringify(combined));
    for (const file of files) {
        fs.unlinkSync(path.join(SPRITES_DIR, file));
    }

    console.log(`Merged ${files.length} atlas JSONs into ${path.relative(ROOT, outPath)} and removed the individual files.`);
    return true;
}

if (require.main === module) {
    combineAtlases();
}

module.exports = { combineAtlases };
