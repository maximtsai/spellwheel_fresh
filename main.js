let isMobile = true;
let pixelWidth = 575;
let pixelHeight = 900;
handleBorders();
let gameVersion = "v.1.19";
let config = {
    type: Phaser.AUTO,
    scale: {
        parent: 'spellwheel',
        autoRound: true,
        width: pixelWidth,
        height: pixelHeight,
        orientation: 'landscape',
        mode: Phaser.Scale.FIT,
        forceLandscape: true
    },
    render: {
        // Leave on to prevent pixelated graphics
        antialias: true,
        roundPixels: true,
    },
    transparent: true,
    expandParent: true,
    clearBeforeRender: false,
    parent: 'spellwheel',
    loader: {
        baseURL: '' // Where we begin looking for files
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    },
    dom: {
        createContainer: true,
    },
};

function testMobile() {
    const regex = /Mobi|Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    return regex.test(navigator.userAgent);
}


function isSafariIOS() {
    var ua = window.navigator.userAgent;
    var iOS = !!ua.match(/iPad/i) || !!ua.match(/iPhone/i);
    var webkit = !!ua.match(/WebKit/i);
    var iOSSafari = iOS && webkit && !ua.match(/CriOS/i);
    return iOSSafari;
}
var game;

async function onloadFunc() {
    // Resolve the platform/local save BEFORE booting Phaser, so preload() can
    // stay synchronous and still see the restored level data.
    await loadSpellwheelProgress();
    game = new Phaser.Game(config); // var canvas = game.canvas;
    return game;
}

let gameConsts = {
    width: config.scale.width,
    halfWidth: config.scale.width * 0.5,
    height: config.scale.height,
    halfHeight: config.scale.height * 0.5,
    SDK: null
};
let challenges = {
    angryEnemies: false,
    lowHealth: false,
};
let cheats = {
    calmEnemies: false,
    extraHealth: false,
    bonusHealth: false,
    extraDmg: false,
    extraExtraDmg: false,
    superShield: false,
    fullArsenal: false,
    extraUlt: false,
    infiniteAmmo: false,
    slowEnemies: false,
    frail: false,
    grudge: false,
    toughEnemies: false,
};
let funnies = {
    mustache: false,
};
let gameOptions = {
    infoBoxAlign: 'center',
};
let gameVars = {
    hideCheatVal: 0,
    latestLevel: 0,
    maxLevel: 0,
    isHardMode: false,
    gameConstructed: false,
    mousedown: false,
    mouseJustDowned: false,
    mouseposx: 0,
    mouseposy: 0,
    lastmousedown: { x: 0, y: 0 },
    timeSlowRatio: 1,
    timeScale: 1,
    gameManualSlowSpeed: 1,
    gameManualSlowSpeedInverse: 1,
    gameScale: 1,
    canvasXOffset: 0,
    canvasYOffset: 0
};
let globalObjects = {};
let updateFunctions = {};
let PhaserScene = null; // Global
let oldTime = 0;
let deltaScale = 1;

// Platform persistence mirrors storageexample.html. The host provides `lib`
// in production; safeStorage remains a local development fallback.
const SPELLWHEEL_SAVE_VERSION = 1;
const SPELLWHEEL_SAVE_DEBOUNCE_MS = 1500;
const SPELLWHEEL_SAVE_MIN_INTERVAL_MS = 1000;
let spellwheelSaveTimer = null;
let spellwheelLastSaveTime = 0;
let spellwheelSaveInFlight = false;
let spellwheelSaveDirty = false;
let spellwheelSaveResetting = false;

function spellwheelSaveState() {
    return {
        v: SPELLWHEEL_SAVE_VERSION,
        latestLevel: gameVars.latestLevel || 0,
        maxLevel: gameVars.maxLevel || 0,
        language: typeof language !== 'undefined' ? language : 'en_us',
        infoBoxAlign: gameOptions.infoBoxAlign || 'center',
        skipIntro: !!gameOptions.skipIntro
    };
}

async function flushSpellwheelSave(force = false) {
    if (spellwheelSaveTimer) {
        clearTimeout(spellwheelSaveTimer);
        spellwheelSaveTimer = null;
    }
    if (spellwheelSaveResetting) return;
    if (spellwheelSaveInFlight) {
        spellwheelSaveDirty = true;
        return;
    }
    const now = Date.now();
    if (!force && now - spellwheelLastSaveTime < SPELLWHEEL_SAVE_MIN_INTERVAL_MS) {
        spellwheelSaveTimer = setTimeout(() => flushSpellwheelSave(false), SPELLWHEEL_SAVE_MIN_INTERVAL_MS - (now - spellwheelLastSaveTime));
        return;
    }
    spellwheelSaveInFlight = true;
    spellwheelSaveDirty = false;
    spellwheelLastSaveTime = now;
    try {
        if (typeof lib !== 'undefined' && lib && typeof lib.saveUserGameState === 'function') {
            await lib.saveUserGameState(spellwheelSaveState());
        } else {
            safeStorage.setItem('spellwheelState', JSON.stringify(spellwheelSaveState()));
        }
    } catch (err) {
        if (typeof lib !== 'undefined' && lib && typeof lib.log === 'function') lib.log('Spellwheel save error: ' + err.message);
    } finally {
        spellwheelSaveInFlight = false;
        if (spellwheelSaveDirty && !spellwheelSaveResetting) {
            requestSpellwheelSave();
        }
    }
}

function requestSpellwheelSave() {
    if (spellwheelSaveResetting) return;
    if (spellwheelSaveTimer) clearTimeout(spellwheelSaveTimer);
    spellwheelSaveTimer = setTimeout(() => flushSpellwheelSave(false), SPELLWHEEL_SAVE_DEBOUNCE_MS);
}

function saveSpellwheelProgress() {
    if (spellwheelSaveResetting) return;
    safeStorage.setItem('latestLevel', String(gameVars.latestLevel || 0));
    safeStorage.setItem('maxLevel', String(gameVars.maxLevel || 0));
    requestSpellwheelSave();
}

if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushSpellwheelSave(true);
    });
}
if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => flushSpellwheelSave(true));
}

async function resetSpellwheelSave() {
    spellwheelSaveResetting = true;
    spellwheelSaveDirty = false;
    if (spellwheelSaveTimer) {
        clearTimeout(spellwheelSaveTimer);
        spellwheelSaveTimer = null;
    }
    safeStorage.removeItem('latestLevel');
    safeStorage.removeItem('maxLevel');
    safeStorage.removeItem('spellwheelState');
    try {
        if (typeof lib !== 'undefined' && lib && typeof lib.deleteUserGameState === 'function') {
            await lib.deleteUserGameState();
        }
    } catch (err) {
        if (typeof lib !== 'undefined' && lib && typeof lib.log === 'function') lib.log('Spellwheel reset error: ' + err.message);
    } finally {
        spellwheelSaveResetting = false;
        spellwheelLastSaveTime = 0;
    }
}

async function loadSpellwheelProgress(){
    try {
        if (typeof lib !== 'undefined' && lib && typeof lib.getUserGameState === 'function') {
            const savedData = await lib.getUserGameState();
            const state = savedData && (savedData.state || savedData);
            if (state && state.v === SPELLWHEEL_SAVE_VERSION) {
                if (Number.isFinite(state.latestLevel)) gameVars.latestLevel = Math.max(0, Math.floor(state.latestLevel));
                if (Number.isFinite(state.maxLevel)) gameVars.maxLevel = Math.max(gameVars.latestLevel, Math.floor(state.maxLevel));
                if (typeof state.language === 'string') language = state.language;
                if (typeof state.infoBoxAlign === 'string') gameOptions.infoBoxAlign = state.infoBoxAlign;
                if (typeof state.skipIntro === 'boolean') gameOptions.skipIntro = state.skipIntro;
                return;
            }
        }
    } catch (err) {
        if (typeof lib !== 'undefined' && lib && typeof lib.log === 'function') lib.log('Spellwheel load error: ' + err.message);
    }
    gameVars.latestLevel = parseInt(safeStorage.getItem("latestLevel"));
    gameVars.maxLevel = parseInt(safeStorage.getItem("maxLevel"));
}

// MUST stay synchronous. Phaser checks load.list.size the instant preload()
// returns; an async preload returns a pending promise with nothing queued yet,
// so Phaser skips straight to create() and every texture create() touches is
// still missing (green placeholder squares). The save is loaded in onloadFunc,
// before the game is constructed, so gameVars is already populated here.
function preload() {
    handleBorders();
    if (!gameVars.latestLevel) {
        gameVars.latestLevel = 0;
    }
    if (!gameVars.maxLevel) {
        gameVars.maxLevel = gameVars.latestLevel;
    } else {
        updateSpellState(gameVars.maxLevel)
    }

    if (isMobile && screen && screen.orientation && screen.orientation.lock) {
        try {
            var myScreenOrientation = window.screen.orientation;
            var lockPromise = myScreenOrientation.lock('portrait');
            if (lockPromise && typeof lockPromise.catch === 'function') {
                lockPromise.catch(function() {});
            }
        } catch (e) {}
    }

    resizeGame();
    let gameDiv = document.getElementById('preload-notice');
    gameDiv.innerHTML = "";
    loadFileList(this, imageFilesPreload, 'image');
    setTimeout(() => {
        resizeGame();
    }, 100)
}

function create() {
    oldTime = Date.now();
    PhaserScene = this;
    onPreloadComplete(this);
}

function onPreloadComplete(scene) {
    showBackground();
    globalObjects.tempBG = scene.add.sprite(gameConsts.halfWidth, gameConsts.halfHeight, 'blackPixel').setScale(1100, 1100).setDepth(-1);

    setupMouseInteraction(scene);
    setupLoadingBar(scene);

    loadAudioFiles(scene);
    loadAtlases(scene);
    loadFileList(scene, imageFiles, 'image');
    loadFileList(scene, fontFiles, 'bitmap_font');
    loadFileList(scene, videoFiles, 'video');

    scene.load.start();
}

// Loads every sprite atlas from a single combined file (sprites/atlases.json).
// Loads sprite atlases from sprites/atlases.json.
// Deferred atlases (deferredImageAtlases) are skipped during initial preload
// and loaded after the game starts via deferredLoader.
function loadAtlases(scene) {
    scene.load.json('_atlasData', 'sprites/atlases.json');
    scene.load.once('filecomplete-json-_atlasData', (fileKey, fileType, atlasData) => {
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
            if (!sheets.length) {
                continue;
            }
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
    });
}

let deferredAudioIndex = {};
for (let i in deferredAudioFiles) {
    deferredAudioIndex[deferredAudioFiles[i].name] = true;
}

function onLoadComplete(scene) {
    initializeSounds(scene);
    initializeBitmapFonts(scene);
    initializeMiscSettings();
    setupGame(scene);
    // Start loading the deferred assets in the background now that the game
    // has started. The main menu shows a small progress bar for them.
    initDeferredLoader(deferredAudioFiles, typeof deferredImageAtlases !== 'undefined' ? deferredImageAtlases : []);
    startDeferredAssets(scene);
}

function openFullscreen() {
    var elem = document.body;
    try {
        if (elem.requestFullscreen) {
            var p = elem.requestFullscreen();
            if (p && typeof p.catch === 'function') {
                p.catch(function() {});
            }
        } else if (elem.webkitRequestFullscreen) { /* Safari */
            elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) { /* IE11 */
            elem.msRequestFullscreen();
        }
    } catch (e) {}
}

document.addEventListener('fullscreenchange', (event) => {
    if (!document.fullscreenElement) {
        gameOptions.fullscreen = false;
    } else {
        gameOptions.fullscreen = true;
    }
    if (globalObjects.options && globalObjects.options.fullscreenToggleVisual) {
        globalObjects.options.fullscreenToggleVisual.setFrame(gameOptions.fullscreen ? 'check_box_on.png' : 'check_box_normal.png');
    }
});

function initializeMiscSettings() {
    language = safeStorage.getItem("language") || 'en_us';
    gameOptions.infoBoxAlign = safeStorage.getItem("info_align") || 'center';

    let storedSkipIntro = safeStorage.getItem("skip_intro");
    // let storedFullscreen = localStorage.getItem("fullscreen");
    // if (storedFullscreen) {
    //     gameOptions.fullscreen = storedFullscreen === 'true';
    //     if (gameOptions.fullscreen) {
    //         openFullscreen();
    //     }
    // }
    if (storedSkipIntro) {
        gameOptions.skipIntro = storedSkipIntro === 'true';
    } else {
        gameOptions.isFirstTime = true;
        safeStorage.setItem("skip_intro", 'true');
    }
}

let lastUpdateValues = [1, 1, 1, 1, 1];
let lastUpdateValuesIdx = 0;
let avgDeltaScale = 1;
let timeUpdateCounter = 0;
let timeUpdateCounterMax = 3;
function update(time, delta) {

    if (loadObjects.loadingSpinner && loadObjects.loadingSpinner.goalRot) {
        let adjustedSpinnerRot = loadObjects.loadingSpinner.rotation;
        if (adjustedSpinnerRot > 0) {
            adjustedSpinnerRot -= Math.PI * 2;
        }
        let rotDiff = loadObjects.loadingSpinner.goalRot - adjustedSpinnerRot;
        loadObjects.loadingSpinner.rotation += rotDiff * Math.min(0.4, delta * 0.01);
        for (let i = 0; i < icons.length; i++) {
            icons[i].rotation = icons[i].startRotation + loadObjects.loadingSpinner.rotation;
        }

    }
    // check mouse
    if (timeUpdateCounter >= timeUpdateCounterMax) {
        timeUpdateCounter = 0;
        let newTime = Date.now();
        let deltaTime = newTime - oldTime;
        oldTime = newTime;
        deltaScale = Math.min(5, deltaTime / 100);
        lastUpdateValues[lastUpdateValuesIdx] = deltaScale;
        lastUpdateValuesIdx = (lastUpdateValuesIdx + 1) % 5;
        avgDeltaScale = 0;
        for (let i = 0; i < 5; i++) {
            avgDeltaScale += lastUpdateValues[i] * 0.2;
        }
    } else {
        timeUpdateCounter++;
    }

    avgDeltaScale *= gameVars.timeScale;
    gameVars.avgDeltaScale = avgDeltaScale;


    buttonManager.update(avgDeltaScale);
    updateManager.update(avgDeltaScale);

    gameVars.mouseJustDowned = false;
    gameVars.mouseJustUpped = false;
    if (!gameVars.wasTouch && game && game.input && game.input.mousePointer && !game.input.mousePointer.isDown && gameVars.mousedown) {
        gameVars.mousedown = false;
    }
}

// Loads audio: the combined bank files first, then any individual sounds
// (music tracks and looping SFX) that were not merged into a bank.
// Deferred assets (deferredAudioFiles) are skipped here and loaded after
// the game starts.
function loadAudioFiles(scene) {
    for (let i in audioBankFiles) {
        let bank = audioBankFiles[i];
        scene.load.audio(bank.name, bank.src);
    }
    for (let i in audioFiles) {
        let data = audioFiles[i];
        if (!audioBankIndex[data.name] && !deferredAudioIndex[data.name]) {
            scene.load.audio(data.name, data.src);
        }
    }
}

function loadFileList(scene, filesList, type) {
    for (let i in filesList) {
        let data = filesList[i];
        switch (type) {
            case 'audio':
                scene.load.audio(data.name, data.src);
                break;
            case 'image':
                scene.load.image(data.name, data.src);
                break;
            case 'bitmap_font':
                if (typeof fontXmlMap !== 'undefined') {
                    // Bundle mode: load only PNG image, parse inlined XML on complete
                    scene.load.image('__bf_img_' + data.name, data.imageUrl);
                } else {
                    // Fallback to separate XML request if running unbundled
                    scene.load.bitmapFont(data.name, data.imageUrl, data.url);
                }
                break;
            case 'video':
                scene.load.video({
                    key: data.name,
                    url: data.src,
                    noAudio: true
                });
                break;
            default:
                console.warn('unrecognized type: ', type);
                break;
        }
    }
}

function initializeBitmapFonts(scene) {
    if (typeof fontXmlMap === 'undefined') return;
    const parser = new DOMParser();
    for (let i in fontFiles) {
        const font = fontFiles[i];
        // fontXmlMap can be keyed by font.name or font.url basename
        const xmlKey = font.name === 'plainBold' ? 'plain_bold' : font.name;
        const xmlString = fontXmlMap[xmlKey] || fontXmlMap[font.name];
        if (!xmlString) {
            console.warn('Missing inlined XML for font:', font.name);
            continue;
        }
        const imgKey = '__bf_img_' + font.name;
        if (!scene.textures.exists(imgKey)) {
            console.warn('Missing texture for font:', font.name);
            continue;
        }
        const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
        const frame = scene.textures.getFrame(imgKey);
        const parsedData = Phaser.GameObjects.BitmapText.ParseXMLBitmapFont(xmlDoc, frame);
        scene.cache.bitmapFont.add(font.name, {
            data: parsedData,
            texture: imgKey,
            frame: null
        });
    }
}

let lastShakeLeft = true;

// All three shakes are the same motion: alternate the starting direction, kick
// the camera out to `amt`, then settle back to 0 with a bounce. They differ
// only in timing, and whether there is an extra rebound before the settle.
function runScreenShake(amt, outDuration, settleDuration, durMultManual = 1, rebound = false) {
    lastShakeLeft = !lastShakeLeft;
    if (lastShakeLeft) {
        amt = -amt;
    }
    const camera = PhaserScene.cameras.main;
    camera.scrollX = -amt;
    const durMult = (1 + 0.1 * amt) * durMultManual;

    const settle = () => {
        PhaserScene.tweens.add({
            targets: camera,
            scrollX: 0,
            ease: "Bounce.easeOut",
            easeParams: [3],
            duration: settleDuration * durMult,
        });
    };

    PhaserScene.tweens.add({
        targets: camera,
        scrollX: amt,
        ease: "Quint.easeOut",
        duration: outDuration * durMult,
        onComplete: rebound
            ? () => {
                PhaserScene.tweens.add({
                    targets: camera,
                    scrollX: -amt * 0.9,
                    ease: "Quint.easeInOut",
                    duration: outDuration * durMult,
                    onComplete: settle
                });
            }
            : settle
    });
}

function screenShake(amt, durMultManual = 1) {
    runScreenShake(amt, 50, 150, durMultManual);
}

function screenShakeLong(amt) {
    runScreenShake(amt, 150, 400);
}

function screenShakeManual(amt, durMultManual = 1) {
    runScreenShake(amt, 50, 150, durMultManual, true);
}

function zoomTemp(zoomAmt) {
    PhaserScene.cameras.main.setZoom(zoomAmt);
    PhaserScene.tweens.add({
        targets: PhaserScene.cameras.main,
        zoom: 1,
        ease: "Cubic.easeOut",
        duration: 200
    });
}

function zoomTempSlow(zoomAmt) {
    PhaserScene.tweens.add({
        targets: PhaserScene.cameras.main,
        zoom: zoomAmt,
        ease: "Cubic.easeIn",
        duration: 40,
        onComplete: () => {
            PhaserScene.tweens.add({
                targets: PhaserScene.cameras.main,
                zoom: 1,
                ease: "Cubic.easeOut",
                duration: 300
            });
        }
    });
}

function handleBorders() {
    let topBorder = document.getElementById('topborder');
    let bottomBorder = document.getElementById('bottomborder');
    if (!topBorder || !bottomBorder) {
        return;
    }
    var windowWidth = window.innerWidth;
    var windowHeight = window.innerHeight;
    var windowRatio = windowWidth / windowHeight;
    var gameRatio = pixelWidth / pixelHeight;
    var gameScale = 1;
    let isTall = false;
    if (windowRatio < gameRatio) {
        gameScale = windowWidth / pixelWidth;
        isTall = true;
    } else {
        gameScale = windowHeight / pixelHeight;
    }
    if (!isTall) {
        topBorder.style.display = 'none';
        bottomBorder.style.display = 'none';
    } else {
        topBorder.style.display = 'block';
        bottomBorder.style.display = 'block';
    }

    let thickness = 86 * gameScale;
    let gameHeightScaled = pixelHeight * gameScale;
    let gameWidthScaled = pixelWidth * gameScale;

    // The image is tall (height is length) and narrow (width is thickness).
    // When rotated 90deg, its CSS height is along the screen X-axis (game width)
    // and its CSS width is along the screen Y-axis (thickness).
    topBorder.style.width = thickness + 'px';
    topBorder.style.height = gameWidthScaled + 'px';
    bottomBorder.style.width = thickness + 'px';
    bottomBorder.style.height = gameWidthScaled + 'px';

    let shiftAmt = (gameHeightScaled * 0.5) + (thickness * 0.5) - 2;
    topBorder.style.top = 'calc(50% - ' + shiftAmt + 'px)';
    topBorder.style.bottom = 'auto';
    bottomBorder.style.bottom = 'calc(50% - ' + shiftAmt + 'px)';
    bottomBorder.style.top = 'auto';
}

function showBackground() {
    let topBorder = document.getElementById('topborder');
    let bottomBorder = document.getElementById('bottomborder');
    let background = document.getElementById('background');

    if (background) {
        background.style['animation-name'] = 'changeShadow';
        background.style.opacity = '1';
    }

    if (topBorder) {
        topBorder.style['animation-name'] = 'changeFull';
        topBorder.style.opacity = '1';
    }
    if (bottomBorder) {
        bottomBorder.style['animation-name'] = 'changeFull';
        bottomBorder.style.opacity = '1';
    }
}

// Resolves a background filename to a loadable URL.
//
// Bundled builds have no local sprites/ directory — every asset lives on the
// CDN — so they emit a backgroundUrls map. Unbundled dev runs have no map and
// fall back to the on-disk path. Without this, background switches silently
// 404 in dist and the backdrop goes blank.
function getBackgroundUrl(name) {
    if (typeof backgroundUrls !== 'undefined' && backgroundUrls[name]) {
        return backgroundUrls[name];
    }
    return 'sprites/preload/' + name;
}

let currBackground = 'grass_bg.webp';

// instant: swap immediately with a short fade-in. Otherwise fade the old
// background out first, then swap once it has gone.
function switchBackground(newBG, instant = false) {
    if (currBackground === newBG) {
        return;
    }
    const background = document.getElementById('background');
    const applyNewBG = () => {
        currBackground = newBG;
        if (!background) {
            return;
        }
        background.style['background-image'] = 'url("' + getBackgroundUrl(newBG) + '")';
        background.style.opacity = '1';
        background.style['animation-duration'] = instant ? '0.5s' : '1.5s';
        background.style['animation-name'] = instant ? 'fastChange' : 'changeShadow';
    };

    if (instant) {
        applyNewBG();
        return;
    }

    if (background) {
        background.style['animation-name'] = 'fadeAway';
        background.style['animation-duration'] = '1.5s';
        background.style.opacity = '0';
    }
    setTimeout(applyNewBG, 1400);
}

function switchBackgroundInstant(newBG) {
    switchBackground(newBG, true);
}

function preloadImage(newBG) {
    let preload = document.getElementById('preload');
    if (preload) {
        preload.style['content'] = 'url("' + getBackgroundUrl(newBG) + '")';
    }
}

function fadeBackground() {
    let background = document.getElementById('background');
    if (background) {
        background.style.opacity = '0';
        background.style['animation-name'] = 'fadeAway';
        background.style['animation-duration'] = '3s';
    }
}
