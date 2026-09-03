const fs = require('fs');
const path = require('path');
const Terser = require('terser');

const SRC = __dirname;
const DIST = path.join(SRC, 'dist');

const acorn = require('acorn');

// Read and parse asset_map
const assetMapPath = path.join(SRC, 'asset_map');
if (!fs.existsSync(assetMapPath)) {
    console.error('Missing asset_map file in root!');
    process.exit(1);
}
const configContent = fs.readFileSync(assetMapPath, 'utf8');
const configSandbox = {};
eval(configContent.replace('const assets =', 'configSandbox.assets ='));
const assets = configSandbox.assets;

// External URL for the combined Atlases + Combat bundle (uploaded to GitHub / CDN).
//
// RELEASE_REF must be an IMMUTABLE git ref — a tag or a full commit SHA. Do not
// point it at a branch: jsDelivr caches branch refs for ~12h and serves them
// mutably, so a player can end up with a stale external.min.js paired with a
// freshly built index.html. That mismatch is silent and does not reproduce
// locally. Because the ref is immutable, the bundle is also permanently
// cacheable — no ?v= timestamp, so returning players do not re-download 428 KB
// on every build.
//
// Set to REMOTE_EXTERNAL_BASE_URL to use CDN hosting, or '' to inline combat bundle directly into index.html
const RELEASE_REF = '995428430161377b2b33cb37a29356cbb62755c6';
const REMOTE_EXTERNAL_BASE_URL = `https://cdn.jsdelivr.net/gh/maximtsai/spellwheel_fresh@${RELEASE_REF}/release/external.min.js`;
const REMOTE_EXTERNAL_URL = '';

// Guard against someone reintroducing a branch/mutable ref.
if (!/^[0-9a-f]{40}$/.test(RELEASE_REF) && !/^v[\d.]+$/.test(RELEASE_REF)) {
    console.warn(
        `[buildAstro] WARNING: RELEASE_REF "${RELEASE_REF}" is not a commit SHA or version tag. ` +
        `jsDelivr serves branch refs mutably with a ~12h cache — players may get a stale bundle.`
    );
}

function getAssetUrl(filename) {
    if (assets[filename]) return assets[filename].url;
    const base = path.basename(filename);
    if (assets[base]) return assets[base].url;
    console.warn(`[buildAstro] Warning: Asset "${filename}" not found in asset_map.`);
    return filename;
}

function stripComments(code) {
    const comments = [];
    try {
        acorn.parse(code, {
            ecmaVersion: 'latest',
            sourceType: 'script',
            locations: true,
            onComment: comments
        });
    } catch (e) {
        console.warn('[buildAstro] Acorn parse warning during comment stripping:', e.message);
        return code;
    }
    let result = code;
    for (let i = comments.length - 1; i >= 0; i--) {
        const c = comments[i];
        result = result.slice(0, c.start) + result.slice(c.end);
    }
    return result;
}

// ---------------------------------------------------------------------------
// Webfonts (loaded from Google's CDN — no local .ttf is bundled)
//
// The five families below are aliases the game asks Phaser for by name
// (fontFamily: 'garamondmax', etc). A src of local() alone only matches fonts
// installed on the player's OS, so on a machine without them every face fails
// and document.fonts.load() rejects with NetworkError. Each face therefore
// lists local() first (free, instant) and then falls back to the matching
// fonts.gstatic.com .woff2.
//
// The URLs are versioned and pinned. To refresh them, re-fetch e.g.
//   curl -H "User-Agent: Mozilla/5.0 ... Chrome/126" \
//        "https://fonts.googleapis.com/css2?family=EB+Garamond:wght@500&display=swap"
// ---------------------------------------------------------------------------
const UNICODE_RANGES = {
    'latin': 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
    'latin-ext': 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF',
    'cyrillic': 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116',
    'cyrillic-ext': 'U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F',
    'vietnamese': 'U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB',
};

const GSTATIC = 'https://fonts.gstatic.com/s/';

const REMOTE_FONT_FACES = [
    {
        family: 'robotomedium',
        weight: 500,
        locals: ['Roboto Medium', 'Roboto'],
        subsets: {
            'latin': 'roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWub2bVmUiAo.woff2',
            'latin-ext': 'roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWub2bVmaiArmlw.woff2',
            'cyrillic': 'roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWub2bVmQiArmlw.woff2',
            'cyrillic-ext': 'roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWub2bVmZiArmlw.woff2',
            'vietnamese': 'roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWub2bVmbiArmlw.woff2',
        }
    },
    {
        family: 'garamondbold',
        weight: 800,
        locals: ['EB Garamond ExtraBold', 'EB Garamond'],
        subsets: {
            'latin': 'ebgaramond/v33/SlGDmQSNjdsmc35JDF1K5E55YMjF_7DPuGi-a_NkBI9_.woff2',
            'latin-ext': 'ebgaramond/v33/SlGDmQSNjdsmc35JDF1K5E55YMjF_7DPuGi-a_NkCo9_S6w.woff2',
            'cyrillic': 'ebgaramond/v33/SlGDmQSNjdsmc35JDF1K5E55YMjF_7DPuGi-a_NkAI9_S6w.woff2',
            'cyrillic-ext': 'ebgaramond/v33/SlGDmQSNjdsmc35JDF1K5E55YMjF_7DPuGi-a_NkCY9_S6w.woff2',
            'vietnamese': 'ebgaramond/v33/SlGDmQSNjdsmc35JDF1K5E55YMjF_7DPuGi-a_NkC49_S6w.woff2',
        }
    },
    {
        family: 'garamondmax',
        weight: 500,
        locals: ['EB Garamond Medium', 'EB Garamond'],
        subsets: {
            'latin': 'ebgaramond/v33/SlGDmQSNjdsmc35JDF1K5E55YMjF_7DPuGi-2fRkBI9_.woff2',
            'latin-ext': 'ebgaramond/v33/SlGDmQSNjdsmc35JDF1K5E55YMjF_7DPuGi-2fRkCo9_S6w.woff2',
            'cyrillic': 'ebgaramond/v33/SlGDmQSNjdsmc35JDF1K5E55YMjF_7DPuGi-2fRkAI9_S6w.woff2',
            'cyrillic-ext': 'ebgaramond/v33/SlGDmQSNjdsmc35JDF1K5E55YMjF_7DPuGi-2fRkCY9_S6w.woff2',
            'vietnamese': 'ebgaramond/v33/SlGDmQSNjdsmc35JDF1K5E55YMjF_7DPuGi-2fRkC49_S6w.woff2',
        }
    },
    {
        // Germania One ships latin only, and has no italic cut — the italic
        // alias points at the same file, matching the old local() setup.
        family: 'germania',
        locals: ['Germania One'],
        subsets: {
            'latin': 'germaniaone/v21/Fh4yPjrqIyv2ucM2qzBjeS3uywhP.woff2',
        }
    },
    {
        family: 'germania_italics',
        style: 'italic',
        locals: ['Germania One'],
        subsets: {
            'latin': 'germaniaone/v21/Fh4yPjrqIyv2ucM2qzBjeS3uywhP.woff2',
        }
    },
];

function buildFontFaceCss() {
    let css = '';
    for (const font of REMOTE_FONT_FACES) {
        for (const [subset, file] of Object.entries(font.subsets)) {
            const src = font.locals.map(l => `local('${l}')`)
                .concat(`url(${GSTATIC}${file}) format('woff2')`)
                .join(', ');
            css += `/* ${font.family} — ${subset} */\n@font-face {\n`;
            css += `    font-family: '${font.family}';\n`;
            css += `    src: ${src};\n`;
            if (font.weight) css += `    font-weight: ${font.weight};\n`;
            if (font.style) css += `    font-style: ${font.style};\n`;
            css += `    font-display: swap;\n`;
            css += `    unicode-range: ${UNICODE_RANGES[subset]};\n`;
            css += `}\n`;
        }
    }
    return css.trim();
}

// Translations / localization files
const TRANSLATION_FILES = [
    'textData1.js',
    'textData2.js',
    'textData3.js',
    'textData4.js',
];

// Combat mechanics, Magic Circle, Spells & Player logic (compiled into combat.min.js)
const COMBAT_FILES = [
    'scripts/statusObj.js',
    'scripts/statusManager.js',
    'scripts/combatTextManager.js',
    'scripts/spellRecorder.js',
    'scripts/spellManager.js',
    'scripts/magicCircle.js',
    'scripts/player.js',
];

// Core bootstrapping, UI, audio, utilities, menus, and level management
const CORE_FILES = [
    // Utilities
    'util/safeStorage.js',
    'util/messageBus.js',
    'util/buttonManager.js',
    'util/updateManager.js',
    'util/button.js',
    'util/hoverText.js',
    'util/mouseManager.js',
    'util/audioManager.js',
    'util/deferredLoader.js',
    'util/helperFunction.js',
    'util/poolManager.js',
    'util/sha256.js',
    // Core game flow & UI
    'scripts/popupManager.js',
    'scripts/deathHandler.js',
    'scripts/levelHandler.js',
    'scripts/tutorialHandler.js',
    'scripts/bgHandler.js',
    'scripts/gameConsts.js',
    'scripts/gameAnims.js',
    'scripts/gameplaySetup.js',
    'scripts/gameStats.js',
    'scripts/textPopupManager.js',
    'scripts/menuButtons.js',
    'scripts/postFightScreen.js',
    'scripts/confirmPopup.js',
    'scripts/bannerTextManager.js',
    'scripts/miscFunctions.js',
    'scripts/encyclopedia.js',
    'scripts/options.js',
    'scripts/cutsceneManager.js',
    'scripts/unlocks.js',
    // Entry point
    'main.js',
];

// Heavy combat & enemy scripts (loaded for in-game battles)
const GAMEPLAY_FILES = [
    'scripts/enemies/enemyhandler.js',
    'scripts/enemies/enemy.js',
    'scripts/enemies/armordummy.js',
    'scripts/enemies/lesserdummy.js',
    'scripts/enemies/dummy.js',
    'scripts/enemies/dummypractice.js',
    'scripts/enemies/dummymind.js',
    'scripts/enemies/dummyshield.js',
    'scripts/enemies/dummybody.js',
    'scripts/enemies/dummytime.js',
    'scripts/enemies/dummyvoid.js',
    'scripts/enemies/superdummy.js',
    'scripts/enemies/water.js',
    'scripts/enemies/goblin.js',
    'scripts/enemies/statue.js',
    'scripts/enemies/killerrobot.js',
    'scripts/enemies/tree.js',
    'scripts/enemies/magician.js',
    'scripts/enemies/knight.js',
    'scripts/enemies/wall.js',
    'scripts/enemies/mantis.js',
    'scripts/enemies/death.js',
    'scripts/enemies/death2.js',
    'scripts/enemies/death2plus.js',
    'scripts/enemies/death3.js',
];

const EXTRA_FILES = [];

async function buildAstro() {
    // Clean dist
    if (fs.existsSync(DIST)) {
        fs.rmSync(DIST, { recursive: true });
    }
    fs.mkdirSync(DIST);

    // 1. Build Audio Banks to calculate sound markers and offsets
    const { buildAudioBanks } = require('./scripts/audioBank.js');
    console.log('Building audio bank index...');
    const audioBanks = buildAudioBanks(path.join(DIST, 'audio'));

    // Remove dist/audio if created by buildAudioBanks since Astro does not use local assets
    const distAudio = path.join(DIST, 'audio');
    if (fs.existsSync(distAudio)) {
        fs.rmSync(distAudio, { recursive: true, force: true });
    }

    // Remap bank files to remote CloudFront URLs from config
    const remoteAudioBankFiles = audioBanks.bankFiles.map(b => ({
        name: b.name,
        src: getAssetUrl(path.basename(b.src))
    }));

    // 2. Read bitmap font XMLs and strip redundant kerning pairs to keep file small (< 100 KB)
    const fontXmlMap = {};
    const fontsDir = path.join(SRC, 'fonts');
    if (fs.existsSync(fontsDir)) {
        for (const entry of fs.readdirSync(fontsDir)) {
            if (entry.endsWith('.xml')) {
                const fontKey = entry.replace('.xml', '');
                let rawXml = fs.readFileSync(path.join(fontsDir, entry), 'utf8');
                rawXml = rawXml.replace(/<!--[\s\S]*?-->/g, '');
                rawXml = rawXml.replace(/<kernings[\s\S]*?<\/kernings>/gi, '');
                rawXml = rawXml.replace(/<kernings[^>]*\/>/gi, '');
                const cleanedXml = rawXml.replace(/\s+/g, ' ').trim();
                fontXmlMap[fontKey] = cleanedXml;
            }
        }
    }

    // 3. Build remote registries
    // imageFilesPreload
    const imageFilesSrc = fs.readFileSync(path.join(SRC, 'imageFiles.js'), 'utf8');
    const imageFilesPreload = [];
    for (const m of imageFilesSrc.matchAll(/name:\s*'([^']+)',\s*src:\s*'sprites\/preload\/([^']+)'/g)) {
        imageFilesPreload.push({
            name: m[1],
            src: getAssetUrl(m[2]) || getAssetUrl(m[1])
        });
    }

    // backgroundUrls: filename -> CDN URL for every sprites/preload asset.
    // switchBackground()/preloadImage() set CSS background-image at runtime and
    // would otherwise build a relative "sprites/preload/..." path, which does
    // not exist in dist. main.js falls back to that path when this map is
    // absent, so unbundled dev runs are unaffected.
    const backgroundUrls = {};
    const preloadDir = path.join(SRC, 'sprites', 'preload');
    if (fs.existsSync(preloadDir)) {
        for (const entry of fs.readdirSync(preloadDir)) {
            backgroundUrls[entry] = getAssetUrl(entry);
        }
    }

    // imageAtlases and deferredImageAtlases
    const deferredImageAtlases = ['ending', 'deathfin', 'wallenemy', 'deathfinal'];
    const imageAtlases = [
        'backgrounds', 'blurry', 'buttons', 'circle', 'deathfin', 'deathfinal',
        'dummyenemy', 'ending', 'enemies', 'lowq', 'misc', 'pixels', 'shields',
        'spells', 'tutorial', 'ui', 'wallenemy', 'water'
    ];

    // fontFiles (with remote image URLs)
    const fontFilesSrc = fs.readFileSync(path.join(SRC, 'fontFiles.js'), 'utf8');
    const fontFiles = [];
    for (const m of fontFilesSrc.matchAll(/name:\s*'([^']+)',\s*url:\s*'([^']+)',\s*imageUrl:\s*'fonts\/([^']+)'/g)) {
        fontFiles.push({
            name: m[1],
            url: m[2],
            imageUrl: getAssetUrl(m[3])
        });
    }

    // audioFiles & deferredAudioFiles
    // Only non-banked standalone sounds (music/loops) need standalone URL entries.
    // Banked SFX are resolved via audioBanks index and loaded from bank0.mp3 / bank1.mp3.
    const audioFilesCode = fs.readFileSync(path.join(SRC, 'audioFiles.js'), 'utf8');
    const audioSandboxFn = new Function(audioFilesCode + '\n; return { audioFiles, deferredAudioFiles };');
    const { audioFiles: rawAudioFiles, deferredAudioFiles: rawDeferredAudioFiles } = audioSandboxFn();

    const remoteAudioFiles = rawAudioFiles
        .filter(a => !audioBanks.bankedSourceFiles.has(path.basename(a.src)))
        .map(a => ({
            name: a.name,
            src: getAssetUrl(a.src)
        }));

    const remoteDeferredAudioFiles = rawDeferredAudioFiles.map(a => ({
        name: a.name,
        src: getAssetUrl(a.src)
    }));

    // 4. Remote Atlases JSON (with remote CloudFront image URLs for every texture sheet)
    const atlases = JSON.parse(fs.readFileSync(path.join(SRC, 'sprites', 'atlases.json'), 'utf8'));
    const remoteAtlases = {};
    for (const [key, val] of Object.entries(atlases)) {
        remoteAtlases[key] = {
            textures: val.textures.map(t => {
                const basename = path.basename(t.image);
                return {
                    ...t,
                    image: getAssetUrl(basename)
                };
            })
        };
    }

    // 5. Build fontXmlMap.js (Bitmap font XML schemas with short line wrapping)
    let fontXmlJs = '// AUTO-GENERATED Bitmap Font XML Map\nconst fontXmlMap = {\n';
    for (const [k, v] of Object.entries(fontXmlMap)) {
        fontXmlJs += '    ' + JSON.stringify(k) + ': [\n';
        for (let i = 0; i < v.length; i += 80) {
            fontXmlJs += '        ' + JSON.stringify(v.slice(i, i + 80)) + ',\n';
        }
        fontXmlJs += '    ].join(""),\n';
    }
    fontXmlJs += '};\n';

    // 6. Build generated registries, audio bank index, and remote atlases
    let generated = '// AUTO-GENERATED Remote Asset Registries (Astro Build)\n';
    generated += 'const imageFilesPreload = ' + JSON.stringify(imageFilesPreload) + ';\n';
    generated += 'const backgroundUrls = ' + JSON.stringify(backgroundUrls) + ';\n';
    generated += 'const imageAtlases = ' + JSON.stringify(imageAtlases) + ';\n';
    generated += 'const deferredImageAtlases = ' + JSON.stringify(deferredImageAtlases) + ';\n';
    generated += 'const imageFiles = [];\n';
    generated += 'const videoFiles = [];\n';
    generated += 'const fontFiles = ' + JSON.stringify(fontFiles) + ';\n';
    generated += 'const audioFiles = ' + JSON.stringify(remoteAudioFiles) + ';\n';
    generated += 'const deferredAudioFiles = ' + JSON.stringify(remoteDeferredAudioFiles) + ';\n\n';
    generated += '// AUTO-GENERATED audio bank index & files\n';
    generated += 'const audioBankIndex = ' + JSON.stringify(audioBanks.index) + ';\n';
    generated += 'const audioBankFiles = ' + JSON.stringify(remoteAudioBankFiles) + ';\n';
    if (!REMOTE_EXTERNAL_URL) {
        generated += 'const inlinedRemoteAtlases = ' + JSON.stringify(remoteAtlases) + ';\n';
    }
    generated = stripComments(generated);

    // 7. Build translations (inlined directly into index.html)
    let translations = '';
    for (const relPath of TRANSLATION_FILES) {
        const fullPath = path.join(SRC, relPath);
        if (!fs.existsSync(fullPath)) {
            console.error(`Missing: ${relPath}`);
            process.exit(1);
        }
        translations += fs.readFileSync(fullPath, 'utf8') + '\n';
    }
    const strippedTranslations = stripComments(translations);

    // 8. Build external bundle (Atlases + Combat combined into dist/external.min.js)
    let combinedCombatOnly = '';
    let combinedExternal = 'var inlinedRemoteAtlases = ' + JSON.stringify(remoteAtlases) + ';\nwindow.inlinedRemoteAtlases = inlinedRemoteAtlases;\n';
    for (const relPath of COMBAT_FILES) {
        const fullPath = path.join(SRC, relPath);
        if (!fs.existsSync(fullPath)) {
            console.error(`Missing: ${relPath}`);
            process.exit(1);
        }
        const fileContent = fs.readFileSync(fullPath, 'utf8') + '\n';
        combinedCombatOnly += fileContent;
        combinedExternal += fileContent;
    }
    const strippedCombat = stripComments(combinedCombatOnly);
    const strippedExternal = stripComments(combinedExternal);
    const minifiedExternal = await Terser.minify(strippedExternal, {
        compress: true,
        mangle: false,
    });
    fs.writeFileSync(path.join(DIST, 'external.min.js'), minifiedExternal.code);
    fs.mkdirSync(path.join(SRC, 'release'), { recursive: true });
    fs.writeFileSync(path.join(SRC, 'release', 'external.min.js'), minifiedExternal.code);
    console.log(`Wrote dist/external.min.js and release/external.min.js: ${(minifiedExternal.code.length / 1024).toFixed(0)} KB (Atlases + Combat for GitHub / URL hosting)`);

    // 9. Build game core (engine bootstrap, UI, loading & main menu)
    let combinedCore = '';
    for (const relPath of CORE_FILES) {
        const fullPath = path.join(SRC, relPath);
        if (!fs.existsSync(fullPath)) {
            console.error(`Missing: ${relPath}`);
            process.exit(1);
        }
        let code = fs.readFileSync(fullPath, 'utf8');

        // Replace any remaining localStorage calls with safeStorage.
        // safeStorage.js is the implementation and must be exempt: rewriting its
        // internal `window.localStorage.getItem` to `window.safeStorage.getItem`
        // makes every method call itself. The recursion throws, the surrounding
        // try/catch swallows it, and the wrapper silently degrades to
        // memory-only storage — i.e. saves never persist across a reload.
        if (relPath !== 'util/safeStorage.js') {
            code = code.replace(/localStorage\./g, 'safeStorage.');
        }

        // If main.js, intercept loadAtlases to use inlined remoteAtlases directly and make onloadFunc idempotent
        if (relPath === 'main.js') {
            const beforeOnload = code;
            code = code.replace(
                /(?:async\s+)?function onloadFunc\(\)\s*\{[\s\S]*?\n\}/,
                `async function onloadFunc() {
    if (game) return game;
    // Await the save before constructing the game: preload() must stay
    // synchronous or Phaser runs create() with nothing loaded.
    await loadSpellwheelProgress();
    if (game) return game;
    game = new Phaser.Game(config);
    return game;
}`
            );
            if (code === beforeOnload) {
                console.error('[buildAstro] FATAL: onloadFunc patch did not match main.js.');
                process.exit(1);
            }
            code = code.replace(
                /function loadAtlases\s*\(scene\)\s*\{[\s\S]*?\n\}/,
                `function loadAtlases(scene) {
    const atlasData = inlinedRemoteAtlases;
    scene.cache.json.add('_atlasData', atlasData);
    let deferredAtlasMap = {};
    if (typeof deferredImageAtlases !== 'undefined') {
        for (let name of deferredImageAtlases) {
            deferredAtlasMap[name] = true;
        }
    }
    for (const key of Object.keys(atlasData)) {
        if (deferredAtlasMap[key]) {
            continue; // Loaded in background after startup
        }
        const sheets = atlasData[key].textures || [];
        if (!sheets.length) continue;
        const sources = new Array(sheets.length);
        const slices = new Array(sheets.length);
        let loadedCount = 0;
        sheets.forEach((sheet, i) => {
            const sheetKey = '_sheet_' + key + '_' + i;
            scene.load.image(sheetKey, sheet.image);
            scene.load.once('filecomplete-image-' + sheetKey, () => {
                sources[i] = scene.textures.get(sheetKey).getSourceImage();
                slices[i] = sheet;
                scene.textures.remove(sheetKey);
                loadedCount++;
                if (loadedCount === sheets.length) {
                    scene.textures.addAtlasJSONArray(key, sources, slices);
                }
            });
        });
    }
}`
            );
        }

        // If scripts/gameplaySetup.js, make createAnimations wait for required textures
        if (relPath === 'scripts/gameplaySetup.js') {
            code = code.replace(
                /createAnimations\(PhaserScene\);/,
                `(function() {
        let s = PhaserScene, n = 0;
        let checkAndCreate = function() {
            let required = ["backgrounds", "buttons", "circle", "enemies", "lowq", "misc", "pixels", "shields", "spells", "tutorial", "ui", "water"];
            let ready = true;
            for (let i = 0; i < required.length; i++) {
                if (!PhaserScene.textures.exists(required[i])) { ready = false; break; }
            }
            if (ready) {
                createAnimations(s);
            } else if (n++ < 200) {
                setTimeout(checkAndCreate, 25);
            }
        };
        checkAndCreate();
    })();`
            );
        }

        // If deferredLoader.js, ensure startDeferredAtlasesInternal uses the cached _atlasData and sets crossOrigin
        if (relPath === 'util/deferredLoader.js') {
            code = code.replace(
                /fetch\('sprites\/atlases\.json'\)[\s\S]*?loadAtlasesFromData\(scene, data, currentSession, onItemFinished\);\s*\}\)/,
                `Promise.resolve(scene.cache.json.get('_atlasData') || inlinedRemoteAtlases).then(function(data) { loadAtlasesFromData(scene, data, currentSession, onItemFinished); })`
            );
            code = code.replace(
                /var img = new Image\(\);/,
                `var img = new Image(); img.crossOrigin = 'anonymous';`
            );
        }

        combinedCore += code + '\n';
    }

    // Add Astrocade run(mode) entry point
    combinedCore += `\nfunction run(mode) {
    if (typeof onloadFunc === 'function') {
        onloadFunc();
    }
}
window.run = run;\n`;
    combinedCore = stripComments(combinedCore);

    // 10. Build gameplay / enemies (inlined directly into index.html)
    let combinedGameplay = '';
    for (const relPath of GAMEPLAY_FILES) {
        const fullPath = path.join(SRC, relPath);
        if (!fs.existsSync(fullPath)) {
            console.error(`Missing: ${relPath}`);
            process.exit(1);
        }
        combinedGameplay += fs.readFileSync(fullPath, 'utf8') + '\n';
    }
    const strippedGameplay = stripComments(combinedGameplay);

    // Copy phaser.min.js
    for (const file of EXTRA_FILES) {
        fs.copyFileSync(path.join(SRC, file), path.join(DIST, file));
        console.log(`Copied ${file}`);
    }

    // Copy asset_map to dist/read-only/asset_map
    const readOnlyDir = path.join(DIST, 'read-only');
    if (!fs.existsSync(readOnlyDir)) {
        fs.mkdirSync(readOnlyDir, { recursive: true });
    }
    fs.copyFileSync(assetMapPath, path.join(readOnlyDir, 'asset_map'));
    console.log('Copied asset_map to dist/read-only/asset_map');

    // Generate style.css with remote CloudFront background and border images
    const grassBgUrl = getAssetUrl('grass_bg.webp');
    const handshieldBackUrl = getAssetUrl('handshield_back.webp');

    const css = `#background {
    margin: 0;
    z-index: -2;
    background-image: url("${grassBgUrl}");
    background-color: #111010;
    background-position: center center;
    background-size: cover;
    background-repeat: no-repeat;
    width: 100%;
    height: 104%;
    animation-duration: 3s;
    opacity: 0;
    animation-iteration-count: 1;
    animation-direction: normal;
    position: fixed;
    top: -3%;
    left: 0;
}
#topborder {
    margin: 0;
    z-index: -1;
    background-image: url("${handshieldBackUrl}");
    background-size: 100% 100%;
    background-repeat: no-repeat;
    width: 86px;
    height: 100%;
    opacity: 0;
    left: 50%;
    top: calc(50% - 430px);
    animation-duration: 0.6s;
    position: fixed;
    transform-origin: center center;
    transform: translate(-50%, -50%) rotate(90deg);
}
#bottomborder {
    margin: 0;
    z-index: -1;
    background-image: url("${handshieldBackUrl}");
    background-size: 100% 100%;
    background-repeat: no-repeat;
    width: 86px;
    height: 100%;
    opacity: 0;
    left: 50%;
    bottom: calc(50% - 430px);
    position: fixed;
    animation-duration: 0.6s;
    transform-origin: center center;
    transform: translate(-50%, 50%) rotate(-90deg);
}
@keyframes changeShadow {
    from { opacity: 0; }
    to { opacity: 1; }
}
@keyframes fadeAway {
    from { opacity: 1; }
    to { opacity: 0; }
}
@keyframes changeFull {
    from { opacity: 0; }
    to { opacity: 1; }
}
@keyframes fastChange {
    from { opacity: 0.5; }
    to { opacity: 1; }
}
html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    max-height: 100%;
    overflow: hidden;
    touch-action: none;
    -ms-overflow-style: none;
    scrollbar-width: none;
    /* Stop the browser's own touch gestures from stealing drags on the wheel:
       no pull-to-refresh / rubber-banding, no double-tap zoom, no text
       selection or long-press callout, no blue tap flash. */
    overscroll-behavior: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
}
/* The page colour lives on <html> ONLY. If <body> also paints a background,
   that background is drawn AFTER negative-z-index elements, which hides
   #background (z-index -2) and the top/bottom borders (z-index -1). */
html {
    background-color: #111010;
}
html::-webkit-scrollbar, body::-webkit-scrollbar {
    display: none;
}
#preload {
    margin: 0;
    height: 0px;
    width: 0px;
    opacity: 0;
    position: fixed;
}
canvas {
    display: block;
    margin: 0;
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    /* The game handles all pointer input itself — hand it every touch instead
       of letting the browser scroll/zoom the page mid-drag. */
    touch-action: none;
}
#spellwheel {
    margin: 0 auto;
    overflow: hidden;
    touch-action: none;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
#spellwheel::-webkit-scrollbar {
    display: none;
}
#preload-notice {
    color: white;
    text-align: center;
    vertical-align: middle;
    white-space: pre-line;
}
${buildFontFaceCss()}`;

    // Script tag for external module bundle if configured
    const remoteExternalTag = REMOTE_EXTERNAL_URL
        ? `<script src="${REMOTE_EXTERNAL_URL}"></script>`
        : '';

    // Inlined combat if not using remote external bundle
    const inlinedCombat = REMOTE_EXTERNAL_URL ? '' : strippedCombat;

    // Assemble and minify inlined JavaScript block
    const rawInlinedJs = `
${fontXmlJs}
${generated}
${strippedTranslations}
${inlinedCombat}
${strippedGameplay}
${combinedCore}
window.addEventListener('resize', function() {
    if (typeof resizeGame === 'function') {
        resizeGame();
    }
});
`;

    const minifiedInlinedJs = await Terser.minify(rawInlinedJs, {
        compress: true,
        mangle: false, // Keep class/function names intact
    });

    // Generate single self-contained index.html with inlined CSS and minified JavaScript
    const html = `<!doctype html>
<html lang="en">
<link href=data:, rel=icon>
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>SpellWheel</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@500&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@800&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@500&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Germania+One&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Germania+One&display=swap" rel="stylesheet">
    <style>
${css}
    </style>
    <script src="https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js"></script>
    ${remoteExternalTag}
</head>
<body>
    <script>
        // Warm the webfonts. A rejection here just means the CDN was
        // unreachable: the text still renders in the fallback family, so
        // swallow it rather than logging an unhandled NetworkError.
        ['robotomedium', 'garamondbold', 'garamondmax', 'germania', 'germania_italics']
            .forEach(function (f) {
                document.fonts.load('10pt "' + f + '"').catch(function () {});
            });
    </script>
    <div id="background"></div>
    <div id="preload"></div>
    <div id="topborder"></div>
    <div id="bottomborder"></div>
    <div style="font-family:robotomedium, 'Roboto', 'Helvetica Neue', Arial, sans-serif; position:absolute; left:-1000px; visibility:hidden;">.</div>
    <div style="font-family:garamondbold, 'EB Garamond', Garamond, Georgia, 'Times New Roman', serif; font-weight:800; position:absolute; left:-1000px; visibility:hidden;">.</div>
    <div style="font-family:garamondmax, 'EB Garamond', Garamond, Georgia, 'Times New Roman', serif; font-weight:500; position:absolute; left:-1000px; visibility:hidden;">.</div>
    <div style="font-family:germania, 'Germania One', Georgia, 'Times New Roman', serif; position:absolute; left:-1000px; visibility:hidden;">.</div>
    <div style="font-family:germania_italics, 'Germania One', Georgia, 'Times New Roman', serif; font-style:italic; position:absolute; left:-1000px; visibility:hidden;">.</div>
    <div id="preload-notice">Loading Preloader ...</div>
    <script>
${minifiedInlinedJs.code}
    </script>
    <script>
        // Bound here, after the bundle above has defined them. The old
        // <body onload=... onresize=...> attributes could fire before this
        // ~600 KB of inline JS finished parsing, throwing "resizeGame is not
        // defined" on a resize during load. onloadFunc keeps its original
        // window-load timing; if load already fired, it is called directly.
        window.addEventListener('resize', function () { resizeGame(); });
        if (document.readyState === 'complete') {
            onloadFunc();
        } else {
            window.addEventListener('load', function () { onloadFunc(); });
        }
    </script>
</body>
</html>`;

    fs.writeFileSync(path.join(DIST, 'index.html'), html);
    console.log(`Wrote dist/index.html: ${(html.length / 1024).toFixed(0)} KB`);
    console.log('[buildAstro] Astro build complete!');
}

buildAstro();
