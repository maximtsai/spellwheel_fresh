// deferredLoader.js
// Manages assets that are loaded after the game starts, including a UI bar
// shown on the main menu.

let deferredAssets = []; // { name, src }
let deferredAtlases = []; // string[] atlas keys
let deferredLoaded = 0;
let deferredStarted = false;
let deferredComplete = false;
let deferredLoaderObjects = null;
let pendingDeferredPlay = {}; // Map of key -> { volume, loop, isMusic } if requested before loaded
let deferredAutoFadeTimer = null;
let deferredLoadSessionId = 0; // Generation token to ignore callbacks from cancelled/restarted loads

function initDeferredLoader(audioList, atlasList) {
    deferredLoadSessionId++;
    deferredAssets = audioList || [];
    deferredAtlases = atlasList || [];
    deferredLoaded = 0;
    deferredStarted = false;
    deferredComplete = false;
    pendingDeferredPlay = {};
    if (deferredAutoFadeTimer) {
        clearTimeout(deferredAutoFadeTimer);
        deferredAutoFadeTimer = null;
    }
}

function getDeferredTotal() { return deferredAssets.length + deferredAtlases.length; }
function getDeferredLoaded() { return deferredLoaded; }
function isDeferredComplete() { return deferredComplete; }

// Track if a deferred audio track was requested before it finished loading.
function requestDeferredAudioPlay(name, volume, loop, isMusic) {
    if (!deferredComplete && deferredAssets.some(function (a) { return a.name === name; })) {
        pendingDeferredPlay[name] = { volume: volume, loop: loop, isMusic: isMusic };
    }
}

function startDeferredAssets(scene) {
    if (deferredStarted) return;
    deferredStarted = true;
    var totalItems = getDeferredTotal();
    if (totalItems === 0) {
        deferredComplete = true;
        return;
    }

    var currentSession = deferredLoadSessionId;
    var remaining = totalItems;

    function itemFinished() {
        if (currentSession !== deferredLoadSessionId) return;
        deferredLoaded++;
        refreshDeferredBar();
        remaining--;
        if (remaining <= 0) {
            deferredComplete = true;
            refreshDeferredBar();
        }
    }

    // 1. Start Deferred Audio
    startDeferredAudioInternal(scene, currentSession, itemFinished);

    // 2. Start Deferred Atlases
    startDeferredAtlasesInternal(scene, currentSession, itemFinished);
}

function startDeferredAudioInternal(scene, currentSession, onItemFinished) {
    if (!deferredAssets.length) return;

    var ctx = scene.sound && scene.sound.context;
    if (!ctx) {
        if (scene.sound && scene.sound.once) {
            scene.sound.once('unlocked', function () {
                if (currentSession === deferredLoadSessionId) {
                    startDeferredAudioInternal(scene, currentSession, onItemFinished);
                }
            });
        }
        return;
    }

    // Pre-seed silent placeholders so playSound() never throws for these keys
    for (var i = 0; i < deferredAssets.length; i++) {
        var asset = deferredAssets[i];
        if (!scene.cache.audio.exists(asset.name)) {
            var silent = ctx.createBuffer(1, 1, ctx.sampleRate);
            scene.cache.audio.add(asset.name, silent);
        }
    }

    for (var i = 0; i < deferredAssets.length; i++) {
        (function (asset) {
            fetch(asset.src)
                .then(function (response) {
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    return response.arrayBuffer();
                })
                .then(function (arrayBuffer) {
                    return ctx.decodeAudioData(arrayBuffer);
                })
                .then(function (audioBuffer) {
                    if (currentSession !== deferredLoadSessionId) return;

                    scene.cache.audio.add(asset.name, audioBuffer);

                    var pendingPlay = pendingDeferredPlay[asset.name];
                    delete pendingDeferredPlay[asset.name];

                    if (soundList && soundList[asset.name]) {
                        var sound = soundList[asset.name];
                        sound.audioBuffer = audioBuffer;
                        sound.duration = audioBuffer.duration;
                        sound.totalDuration = audioBuffer.duration;

                        var shouldPlay = sound.isPlaying || !!pendingPlay;
                        if (pendingPlay) {
                            sound.fullVolume = pendingPlay.volume;
                            sound.loop = pendingPlay.loop;
                            sound.isMusic = pendingPlay.isMusic;
                            var globalToUse = sound.isMusic ? globalMusicVol : globalVolume;
                            sound.volume = sound.fullVolume * globalToUse;
                        }

                        if (shouldPlay) {
                            sound.stop();
                            sound.play();
                        }
                    } else if (pendingPlay) {
                        playSound(asset.name, pendingPlay.volume, pendingPlay.loop, pendingPlay.isMusic);
                    }

                    onItemFinished();
                })
                .catch(function (err) {
                    if (currentSession !== deferredLoadSessionId) return;
                    console.warn('deferredLoader: failed to load audio ' + asset.name, err);
                    onItemFinished();
                });
        })(deferredAssets[i]);
    }
}

function startDeferredAtlasesInternal(scene, currentSession, onItemFinished) {
    if (!deferredAtlases.length) return;

    var atlasData = scene.cache.json.get('_atlasData');
    if (!atlasData) {
        // If _atlasData JSON isn't cached yet, fetch it
        fetch('sprites/atlases.json')
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (currentSession !== deferredLoadSessionId) return;
                loadAtlasesFromData(scene, data, currentSession, onItemFinished);
            })
            .catch(function (err) {
                console.warn('deferredLoader: failed to load atlases.json', err);
                for (var i = 0; i < deferredAtlases.length; i++) {
                    onItemFinished();
                }
            });
    } else {
        loadAtlasesFromData(scene, atlasData, currentSession, onItemFinished);
    }
}

function loadAtlasesFromData(scene, atlasData, currentSession, onItemFinished) {
    for (var i = 0; i < deferredAtlases.length; i++) {
        (function (key) {
            var atlasEntry = atlasData[key];
            var sheets = (atlasEntry && atlasEntry.textures) || [];
            if (!sheets.length) {
                onItemFinished();
                return;
            }

            var sources = new Array(sheets.length);
            var slices = new Array(sheets.length);
            var loadedCount = 0;

            sheets.forEach(function (sheet, idx) {
                var sheetKey = '_sheet_' + key + '_' + idx;
                var img = new Image();
                img.onload = function () {
                    if (currentSession !== deferredLoadSessionId) return;
                    if (!scene.textures.exists(sheetKey)) {
                        scene.textures.addImage(sheetKey, img);
                    }
                    sources[idx] = scene.textures.get(sheetKey).getSourceImage();
                    slices[idx] = sheet;
                    scene.textures.remove(sheetKey);
                    loadedCount++;
                    if (loadedCount === sheets.length) {
                        scene.textures.addAtlasJSONArray(key, sources, slices);
                        registerDeferredAtlasAnimations(scene, key);
                        onItemFinished();
                    }
                };
                img.onerror = function (err) {
                    if (currentSession !== deferredLoadSessionId) return;
                    console.warn('deferredLoader: failed to load sheet ' + sheet.image, err);
                    loadedCount++;
                    if (loadedCount === sheets.length) {
                        onItemFinished();
                    }
                };
                img.src = sheet.image;
            });
        })(deferredAtlases[i]);
    }
}

// Ensure any animations depending on deferred atlas frames are created once the atlas is registered
function registerDeferredAtlasAnimations(scene, atlasKey) {
    if (!scene || !scene.anims) return;
    if (atlasKey === 'deathfin') {
        if (!scene.anims.exists('ladydeathcape')) {
            scene.anims.create({
                key: 'ladydeathcape',
                frames: scene.anims.generateFrameNames('deathfin', {
                    prefix: 'frame00',
                    suffix: '.png',
                    start: 0,
                    end: 74,
                    zeroPad: 2,
                }),
                repeat: -1,
                frameRate: 20
            });
        }
        if (!scene.anims.exists('ladydeathhood')) {
            scene.anims.create({
                key: 'ladydeathhood',
                frames: scene.anims.generateFrameNames('deathfin', {
                    prefix: 'hood00',
                    suffix: '.png',
                    start: 1,
                    end: 75,
                    zeroPad: 2,
                }),
                repeat: -1,
                frameRate: 20
            });
        }
    } else if (atlasKey === 'deathfinal') {
        if (!scene.anims.exists('death2laugh')) {
            scene.anims.create({
                key: 'death2laugh',
                frames: scene.anims.generateFrameNames('deathfinal', {
                    prefix: 'death2laugh',
                    suffix: '.png',
                    start: 1,
                    end: 2,
                    zeroPad: 0,
                }),
                frameRate: 3,
                repeat: -1,
            });
        }
        if (!scene.anims.exists('death2laughtext')) {
            scene.anims.create({
                key: 'death2laughtext',
                frames: scene.anims.generateFrameNames('deathfinal', {
                    prefix: 'death2laughtext',
                    suffix: '.png',
                    start: 1,
                    end: 2,
                    zeroPad: 0,
                }),
                frameRate: 6,
                repeat: -1,
            });
        }
    }
}

// ---- UI indicator (shown on the main menu) ----

var CORNER_X = 10;
var CORNER_Y = 10;

function createDeferredLoadingBar(scene) {
    if (deferredLoaderObjects) return;
    if (deferredComplete) return; // Don't show if all deferred assets already loaded

    if (deferredAutoFadeTimer) {
        clearTimeout(deferredAutoFadeTimer);
        deferredAutoFadeTimer = null;
    }

    var text = scene.add.text(CORNER_X, CORNER_Y, '',
        { fontFamily: 'germania', fontSize: 14, color: '#242424', align: 'left' })
        .setOrigin(0, 0).setDepth(1000000);

    deferredLoaderObjects = { text: text, scene: scene };
    refreshDeferredBar();
}

function refreshDeferredBar() {
    if (!deferredLoaderObjects) return;
    var total = getDeferredTotal();
    var loaded = deferredLoaded;

    if (deferredComplete) {
        deferredLoaderObjects.text.setText('ALL FILES LOADED');
        // Auto fade-out and cleanup after completion
        if (deferredLoaderObjects.scene && !deferredAutoFadeTimer) {
            deferredAutoFadeTimer = setTimeout(function () {
                if (deferredLoaderObjects && deferredLoaderObjects.scene && deferredLoaderObjects.text) {
                    deferredLoaderObjects.scene.tweens.add({
                        targets: deferredLoaderObjects.text,
                        alpha: 0,
                        duration: 800,
                        onComplete: function () {
                            destroyDeferredLoadingBar();
                        }
                    });
                }
            }, 1200);
        }
    } else {
        deferredLoaderObjects.text.setText('LOADING EXTRA: ' + loaded + '/' + total);
    }
}

function destroyDeferredLoadingBar() {
    if (deferredAutoFadeTimer) {
        clearTimeout(deferredAutoFadeTimer);
        deferredAutoFadeTimer = null;
    }
    if (!deferredLoaderObjects) return;
    if (deferredLoaderObjects.text) deferredLoaderObjects.text.destroy();
    deferredLoaderObjects = null;
}
