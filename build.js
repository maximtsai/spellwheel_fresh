const fs = require('fs');
const path = require('path');
const Terser = require('terser');

const SRC = __dirname;
const DIST = path.join(SRC, 'dist');

const JS_FILES = [
    // Data registries (must come first)
    'audioFiles.js',
    'imageFiles.js',
    'fontFiles.js',
    'textData1.js',
    'textData2.js',
    'textData3.js',
    'textData4.js',
    // Utilities
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
    // Game scripts (in dependency order per scripts/combine_m.sh)
    'scripts/popupManager.js',
    'scripts/deathHandler.js',
    'scripts/levelHandler.js',
    'scripts/tutorialHandler.js',
    'scripts/bgHandler.js',
    'scripts/gameConsts.js',
    'scripts/gameAnims.js',
    'scripts/gameplaySetup.js',
    'scripts/gameStats.js',
    'scripts/spellManager.js',
    'scripts/statusObj.js',
    'scripts/statusManager.js',
    'scripts/textPopupManager.js',
    'scripts/combatTextManager.js',
    'scripts/spellRecorder.js',
    'scripts/magicCircle.js',
    'scripts/player.js',
    'scripts/menuButtons.js',
    'scripts/postFightScreen.js',
    'scripts/confirmPopup.js',
    'scripts/bannerTextManager.js',
    'scripts/miscFunctions.js',
    'scripts/encyclopedia.js',
    'scripts/options.js',
    'scripts/cutsceneManager.js',
    'scripts/unlocks.js',
    // Enemies (in dependency order per enemies/combine_m.sh)
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
    // Entry point (must be last)
    'main.js',
];

const COPY_DIRS = ['sprites', 'audio', 'fonts'];
const EXTRA_FILES = ['phaser.min.js'];

function copyRecursive(src, dest, exclude = null) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
        const srcPath = path.join(src, entry);
        const destPath = path.join(dest, entry);
        if (fs.statSync(srcPath).isDirectory()) {
            copyRecursive(srcPath, destPath, exclude);
        } else if (!exclude || !exclude.has(entry)) {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

async function build() {
    // Clean dist
    if (fs.existsSync(DIST)) {
        fs.rmSync(DIST, { recursive: true });
    }
    fs.mkdirSync(DIST);

    // Build audio banks first (merge small SFX into a few larger files).
    // The index is injected into the bundle so audioManager/main.js can use it.
    const { buildAudioBanks } = require('./scripts/audioBank.js');
    console.log('Building audio banks...');
    const audioBanks = buildAudioBanks(path.join(DIST, 'audio'));

    // Read TTF fonts and encode to base64 Data URIs to eliminate loose font files in dist
    const fontXmlMap = {};
    const ttfBase64 = {};
    const fontsDir = path.join(SRC, 'fonts');
    const fontExcludeSet = new Set();
    if (fs.existsSync(fontsDir)) {
        for (const entry of fs.readdirSync(fontsDir)) {
            if (entry.endsWith('.xml')) {
                fontExcludeSet.add(entry);
                const fontKey = entry.replace('.xml', '');
                const rawXml = fs.readFileSync(path.join(fontsDir, entry), 'utf8');
                const cleanedXml = rawXml.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim();
                fontXmlMap[fontKey] = cleanedXml;
            } else if (entry.endsWith('.ttf')) {
                fontExcludeSet.add(entry);
                ttfBase64[entry] = fs.readFileSync(path.join(fontsDir, entry)).toString('base64');
            }
        }
    }

    // Concatenate JS
    let combined = '';
    for (const relPath of JS_FILES) {
        const fullPath = path.join(SRC, relPath);
        if (!fs.existsSync(fullPath)) {
            console.error(`Missing: ${relPath}`);
            process.exit(1);
        }
        combined += fs.readFileSync(fullPath, 'utf8') + '\n';
    }
    // Inject the auto-generated audio bank index (used by audioManager + main.js)
    combined += '\n// AUTO-GENERATED audio bank index\n';
    combined += 'const audioBankIndex = ' + JSON.stringify(audioBanks.index) + ';\n';
    combined += 'const audioBankFiles = ' + JSON.stringify(audioBanks.bankFiles) + ';\n';
    // Inject the auto-generated bitmap font XML data map
    combined += '\n// AUTO-GENERATED bitmap font XML map\n';
    combined += 'const fontXmlMap = ' + JSON.stringify(fontXmlMap) + ';\n';
    console.log(`Concatenated: ${(combined.length / 1024).toFixed(0)} KB`);

    // Write unminified game.js
    fs.writeFileSync(path.join(DIST, 'game.js'), combined);
    console.log(`Wrote unminified game.js: ${(combined.length / 1024).toFixed(0)} KB`);

    // Copy phaser.min.js
    for (const file of EXTRA_FILES) {
        fs.copyFileSync(path.join(SRC, file), path.join(DIST, file));
        console.log(`Copied ${file}`);
    }

    // Copy asset directories
    for (const dir of COPY_DIRS) {
        const srcDir = path.join(SRC, dir);
        if (fs.existsSync(srcDir)) {
            let exclude = null;
            if (dir === 'audio') {
                exclude = audioBanks.bankedSourceFiles;
            } else if (dir === 'fonts') {
                exclude = fontExcludeSet;
            }
            copyRecursive(srcDir, path.join(DIST, dir), exclude);
            console.log(`Copied ${dir}/`);
        }
    }

    // Generate sprite manifest (single-file sprite reference) into dist
    const { generateSpriteManifest } = require('./scripts/genSpriteManifest.js');
    generateSpriteManifest(path.join(DIST, 'spriteManifest.js'));

    // Generate index.html with Google Fonts CDN links
    const html = `<!doctype html>
<html lang="en">
<link href=data:, rel=icon>
<head>
    <meta charset="UTF-8" />
    <title>SpellWheel</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@500&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@800&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@500&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Germania+One&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Germania+One&display=swap" rel="stylesheet">
    <script src="phaser.min.js"></script>
    <script src="game.js"></script>
    <noscript>Enable JavaScript to play this game.</noscript>
    <style media='screen' type="text/css">
        #background {
            margin: 0;
            z-index: -2;
            background-image: url("sprites/preload/grass_bg.webp");
            background-color: #111010;
            background-position: center;
            background-size: cover;
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
        #leftborder {
            margin: 0;
            z-index: -1;
            background-image: url("sprites/preload/handshield_back.webp");
            background-size: cover;
            height: 100%;
            width: 86px;
            opacity: 0;
            max-height: 100%;
            left: calc(50% - 453px);
            animation-duration: 0.6s;
            position: fixed;
        }
        #rightborder {
            margin: 0;
            z-index: -1;
            background-image: url("sprites/preload/handshield_back.webp");
            background-size: cover;
            height: 100%;
            width: 86px;
            opacity: 0;
            max-height: 100%;
            right: calc(50% - 453px);
            position: fixed;
            animation-duration: 0.6s;
            -moz-transform: scaleX(-1);
            -o-transform: scaleX(-1);
            -webkit-transform: scaleX(-1);
            transform: scaleX(-1);
            filter: FlipH;
            -ms-filter: "FlipH";
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
            background-color: #111010;
            -ms-overflow-style: none;  /* IE and Edge */
            scrollbar-width: none;  /* Firefox */
        }
        html::-webkit-scrollbar, body::-webkit-scrollbar {
            display: none; /* Chrome, Safari, Opera */
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
        }
        #spellwheel {
            margin: 0 auto;
            overflow: hidden;
        }
        #preload-notice {
            color: white;
            text-align: center;
            vertical-align: middle;
            white-space: pre-line
        }
        @font-face {
            font-family: 'robotomedium';
            src: local('Roboto Medium'), local('Roboto');
            font-weight: 500;
        }
        @font-face {
            font-family: 'garamondbold';
            src: local('EB Garamond ExtraBold'), local('EB Garamond');
            font-weight: 800;
        }
        @font-face {
            font-family: 'garamondmax';
            src: local('EB Garamond Medium'), local('EB Garamond');
            font-weight: 500;
        }
        @font-face {
            font-family: 'germania';
            src: local('Germania One');
        }
        @font-face {
            font-family: 'germania_italics';
            src: local('Germania One');
            font-style: italic;
        }
    </style>
</head>
<body onload="onloadFunc()" onresize="resizeGame()">
    <script>
        document.fonts.load('10pt "robotomedium"')
        document.fonts.load('10pt "garamondbold"')
        document.fonts.load('10pt "garamondmax"')
        document.fonts.load('10pt "germania"')
        document.fonts.load('10pt "germania_italics"')
    </script>
    <div id="background"></div>
    <div id="preload"></div>
    <div id="leftborder"></div>
    <div id="rightborder"></div>
    <div style="font-family:robotomedium, 'Roboto'; position:absolute; left:-1000px; visibility:hidden;">.</div>
    <div style="font-family:garamondbold, 'EB Garamond'; font-weight:800; position:absolute; left:-1000px; visibility:hidden;">.</div>
    <div style="font-family:garamondmax, 'EB Garamond'; font-weight:500; position:absolute; left:-1000px; visibility:hidden;">.</div>
    <div style="font-family:germania, 'Germania One'; position:absolute; left:-1000px; visibility:hidden;">.</div>
    <div style="font-family:germania_italics, 'Germania One'; font-style:italic; position:absolute; left:-1000px; visibility:hidden;">.</div>
    <div id="preload-notice">Loading Preloader ...</div>
</body>
</html>`;

    fs.writeFileSync(path.join(DIST, 'index.html'), html);
    console.log('Wrote dist/index.html');
    console.log('Build complete.');
}

build();
