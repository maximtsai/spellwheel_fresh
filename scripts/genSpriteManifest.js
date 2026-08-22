/**
 * Generates spriteManifest.js — a single, human-friendly file that lists every
 * sprite in the game, for easy copy-pasting into game code.
 *
 * Usage:
 *   node scripts/genSpriteManifest.js                  (writes ./spriteManifest.js)
 *   generateSpriteManifest(outPath)                    (called from build.js)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SPRITES_DIR = path.join(ROOT, 'sprites');
const DEFAULT_OUT = path.join(ROOT, 'spriteManifest.js');

function readImageFilesPreload() {
    const src = fs.readFileSync(path.join(ROOT, 'imageFiles.js'), 'utf8');
    const entries = [];
    for (const m of src.matchAll(/name: '([^']+)', src: 'sprites\/preload\/([^']+)'/g)) {
        entries.push({ key: m[1], file: m[2] });
    }
    entries.sort((a, b) => a.key.localeCompare(b.key));
    return entries;
}

function readAtlases() {
    const atlases = [];
    const combined = JSON.parse(fs.readFileSync(path.join(SPRITES_DIR, 'atlases.json'), 'utf8'));
    for (const key of Object.keys(combined).sort()) {
        const data = combined[key];
        const sheets = {};
        for (const tex of data.textures || []) {
            const sheet = path.basename(tex.image);
            const frames = (tex.frames || [])
                .map((f) => f.filename)
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b));
            sheets[sheet] = frames;
        }
        atlases.push({ key, sheets });
    }
    return atlases;
}

function generateSpriteManifest(outPath = DEFAULT_OUT) {
    const preload = readImageFilesPreload();
    const atlases = readAtlases();

    const lines = [];
    lines.push('/**');
    lines.push(' * spriteManifest.js — every sprite in SpellWheel.');
    lines.push(' *');
    lines.push(' * AUTO-GENERATED from sprites/atlases.json + imageFiles.js — do not edit by hand.');
    lines.push(' * Regenerated on every build (node build.js) or via:  node scripts/genSpriteManifest.js');
    lines.push(' *');
    lines.push(' * HOW TO USE');
    lines.push(' *   Preload images (loaded as individual images) are referenced by key:');
    lines.push(' *     this.add.image(x, y, \'whitePixel\')');
    lines.push(' *   Atlas frames are referenced by atlas key + frame name:');
    lines.push(' *     this.add.image(x, y, \'misc\', \'scythe1.png\')');
    lines.push(' *   Each atlas lists its texture sheet(s) and the frames on each sheet.');
    lines.push(' */');
    lines.push('');
    lines.push('const spriteManifest = {');
    lines.push('    preload: {');
    for (const { key, file } of preload) {
        lines.push(`        ${key}: '${file}',`);
    }
    lines.push('    },');
    lines.push('    atlases: {');
    for (const { key, sheets } of atlases) {
        lines.push(`        ${key}: {`);
        const sheetNames = Object.keys(sheets);
        for (const sheet of sheetNames) {
            lines.push(`            '${sheet}': [`);
            for (const frame of sheets[sheet]) {
                lines.push(`                '${frame}',`);
            }
            lines.push('            ],');
        }
        lines.push('        },');
    }
    lines.push('    },');
    lines.push('};');
    lines.push('');

    fs.writeFileSync(outPath, lines.join('\n'));
    const frameCount = atlases.reduce(
        (n, a) => n + Object.values(a.sheets).reduce((m, f) => m + f.length, 0),
        0
    );
    console.log(`Wrote ${path.relative(ROOT, outPath)} (${atlases.length} atlases, ${preload.length} preload images, ${frameCount} frames)`);
    return outPath;
}

if (require.main === module) {
    generateSpriteManifest();
}

module.exports = { generateSpriteManifest };
