let mouseManager;

class InternalMouseManager {
    constructor() {
    }

    onPointerMove(pointer) {
        gameVars.wasTouch = pointer.wasTouch || pointer.pointerType === "touch";
        let handPos = mouseToHand(pointer.x, pointer.y, true);
        gameVars.mouseposx = handPos.x;
        gameVars.mouseposy = handPos.y;
        messageBus.publish("pointerMove", handPos.x, handPos.y);
    }

    onPointerMovePhaserInGame(pointer) {
        // Phaser input space: pointer.x/y are already canvas/game coordinates,
        // the same space used by onPointerDown (baseTouchLayer). Convert WITHOUT
        // the window->game re-scaling that onPointerMove (window event) applies.
        gameVars.wasTouch = pointer.wasTouch || pointer.pointerType === "touch";
        let handPos = mouseToHand(pointer.x, pointer.y, false);
        gameVars.mouseposx = handPos.x;
        gameVars.mouseposy = handPos.y;
        messageBus.publish("pointerMove", handPos.x, handPos.y);
    }

    // onTouchMove(x, y) {
    //     gameVars.wasTouch = true;
    //     let handPos = mouseToHand(x, y, true);
    //     gameVars.mouseposx = handPos.x;
    //     gameVars.mouseposy = handPos.y;
    //     messageBus.publish("pointerMove", handPos.x, handPos.y);
    // }

    onPointerDown(pointer) {
        gameVars.wasTouch = !!(pointer.wasTouch || pointer.pointerType === "touch");
        gameVars.mousedown = true;
        gameVars.mouseJustDowned = true;
        let handPos = mouseToHand(pointer.x, pointer.y);
        gameVars.mouseposx = handPos.x;
        gameVars.mouseposy = handPos.y;

        gameVars.lastmousedown.x = handPos.x;
        gameVars.lastmousedown.y = handPos.y;
        messageBus.publish("pointerDown", handPos.x, handPos.y);
    }

    onPointerDownAlt(pointer) {
        let handPos = mouseToHand(pointer.x !== undefined ? pointer.x : pointer.clientX, pointer.y !== undefined ? pointer.y : pointer.clientY, true);
        gameVars.wasTouch = !!(pointer.wasTouch || pointer.pointerType === "touch");
        gameVars.mousedown = true;
        gameVars.mouseJustDowned = true;
        gameVars.mouseposx = handPos.x;
        gameVars.mouseposy = handPos.y;

        gameVars.lastmousedown.x = handPos.x;
        gameVars.lastmousedown.y = handPos.y;
        messageBus.publish("pointerDown", handPos.x, handPos.y);
    }

    onPointerUpPhaserInGame(pointer) {
        let px = pointer && pointer.x !== undefined ? pointer.x : gameVars.mouseposx;
        let py = pointer && pointer.y !== undefined ? pointer.y : gameVars.mouseposy;
        let handPos = mouseToHand(px, py, false);
        gameVars.wasTouch = pointer ? !!(pointer.wasTouch || pointer.pointerType === "touch") : gameVars.wasTouch;
        gameVars.mousedown = false;
        gameVars.mouseJustUpped = true;
        gameVars.mouseposx = handPos.x;
        gameVars.mouseposy = handPos.y;
        messageBus.publish("pointerUp", handPos.x, handPos.y);
    }

    onPointerUpAlt(pointer) {
        if (!gameVars.mousedown) {
            return;
        }
        let px = pointer && (pointer.clientX !== undefined ? pointer.clientX : pointer.x);
        let py = pointer && (pointer.clientY !== undefined ? pointer.clientY : pointer.y);
        let handPos = px !== undefined && py !== undefined ? mouseToHand(px, py, true) : {x: gameVars.mouseposx, y: gameVars.mouseposy};
        gameVars.wasTouch = pointer ? !!(pointer.wasTouch || pointer.pointerType === "touch") : gameVars.wasTouch;
        gameVars.mousedown = false;
        gameVars.mouseJustUpped = true;
        gameVars.mouseposx = handPos.x;
        gameVars.mouseposy = handPos.y;
        messageBus.publish("pointerUp", handPos.x, handPos.y);
    }
}

mouseManager = new InternalMouseManager();

// Converts position of mouse into position of hand
function mouseToHand(x, y, convertFromWindow = false) {
    let inGameX = x;
    let inGameY = y;
    if (convertFromWindow) {
        inGameX = (inGameX - gameVars.canvasXOffset) / gameVars.gameScale;
        inGameY = (inGameY - gameVars.canvasYOffset) / gameVars.gameScale;
    }

    let bufferDist = 0;
    let xRatio = gameConsts.halfWidth / (gameConsts.halfWidth - bufferDist);
    let yRatio = gameConsts.halfHeight / (gameConsts.halfHeight - bufferDist);
    let handX = gameConsts.halfWidth + xRatio * (inGameX - gameConsts.halfWidth);
    let handY = gameConsts.halfHeight + yRatio * (inGameY - gameConsts.halfHeight);
    handX = Math.min(Math.max(0, handX), gameConsts.width - 1);
    handY = Math.min(Math.max(0, handY), gameConsts.height - 1);
    return {x: handX, y: handY};
}

function setupMouseInteraction(scene) {
    let baseTouchLayer = scene.make.image({
        x: 0, y: 0, key: 'whitePixel', add: true, scale: {x: gameConsts.width, y: gameConsts.height}, alpha: 0.001});
    baseTouchLayer.setInteractive();
    baseTouchLayer.on('pointerdown', mouseManager.onPointerDown, scene);
    // Phaser's unified input manager reliably delivers pointermove and pointerup for
    // BOTH mouse and touch drags (window.onpointermove / window.onpointerup do NOT fire
    // reliably for mobile touch drags captured by Phaser).
    scene.input.on('pointermove', mouseManager.onPointerMovePhaserInGame, scene);
    scene.input.on('pointerup', mouseManager.onPointerUpPhaserInGame, scene);
    scene.input.on('pointerupoutside', mouseManager.onPointerUpPhaserInGame, scene);
    scene.input.on('gameout', mouseManager.onPointerUpPhaserInGame, scene);

    let hagVar1 = "b25wb2ludGVybW92ZQ==";
    let hagVar2 = "bG9jYXRpb24=";
    let hagVar3 = "b25wb2ludGVydXA=";

    globalObjects.input1 = window[ajaxzig("b25wb2ludGVybW92ZQ==")] = (pointer) => {
        mouseManager.onPointerMove(pointer);
    };
    globalObjects.input2 = window[ajaxzig("bG9jYXRpb24=")];
    globalObjects.input3 = window[ajaxzig("b25wb2ludGVydXA=")] = (pointer) => {
        mouseManager.onPointerUpAlt(pointer);
    };

    // Extra fallback window listeners for touchcancel/pointercancel/touchend/mouseup
    if (typeof window !== 'undefined') {
        window.addEventListener('pointerup', (e) => mouseManager.onPointerUpAlt(e));
        window.addEventListener('pointercancel', (e) => mouseManager.onPointerUpAlt(e));
        window.addEventListener('touchend', (e) => mouseManager.onPointerUpAlt(e));
        window.addEventListener('touchcancel', (e) => mouseManager.onPointerUpAlt(e));
        window.addEventListener('mouseup', (e) => mouseManager.onPointerUpAlt(e));
    }
}
let canResizeGame = true;
function resizeGame() {
    if (!canResizeGame) {
        return;
    }
    if (!game) {
        return;
    }
    if (!game.canvas) {
        return;
    }
    var canvas = game.canvas; //document.querySelector("canvas");
    var windowWidth = window.innerWidth;
    var windowHeight = window.innerHeight;
    var windowRatio = windowWidth / windowHeight;
    var gameRatio = game.config.width / game.config.height;
    var gameScale = 1;
    let background = document.getElementById('background');
    if (windowRatio < gameRatio) {
        canvas.style.width = windowWidth + "px";
        canvas.style.height = windowWidth / gameRatio + "px";
        gameScale = windowWidth / game.config.width;
        gameVars.canvasXOffset = 0;
        gameVars.canvasYOffset = (windowHeight - game.config.height * gameScale) * 0.5;
        if (background) background.style.opacity = '1';
    } else {
        canvas.style.width = windowHeight * gameRatio + "px";
        canvas.style.height = windowHeight + "px";
        gameScale = windowHeight / game.config.height;
        gameVars.canvasYOffset = 0;
        gameVars.canvasXOffset = (windowWidth - game.config.width * gameScale) * 0.5;
        if (background) background.style.opacity = '1';
    }
    gameVars.gameScale = gameScale;

    handleBorders();

}

