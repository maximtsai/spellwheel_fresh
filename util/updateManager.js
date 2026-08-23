let updateManager;

class UpdateManager {
    constructor() {
        this.listOfFunctions = [];
    }

    update(delta) {
        for (let i = 0; i < this.listOfFunctions.length; i++) {
            try {
                this.listOfFunctions[i](delta);
            } catch (e) {
                // One bad callback shouldn't kill the whole frame loop
                console.error('Error in UpdateManager function:', e);
            }
        }
    }

    addFunction(func) {
        // first check if the function already exists
        for (let i = 0; i < this.listOfFunctions.length; i++) {
            if (func === this.listOfFunctions[i]) {
                return;
            }
        }
        this.listOfFunctions.push(func);
        return func;
    }

    removeFunction(func) {
        for (let i = 0; i < this.listOfFunctions.length; i++) {
            if (func === this.listOfFunctions[i]) {
                this.listOfFunctions.splice(i, 1);
                break;
            }
        }
    }
}

updateManager = new UpdateManager();
