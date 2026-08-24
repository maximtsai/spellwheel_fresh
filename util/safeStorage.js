var _memoryStorage = {};
var safeStorage = {
    getItem: function(key) {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                var val = window.localStorage.getItem(key);
                if (val !== null) return val;
            }
        } catch (e) {
            // Sandboxed iframe or storage restricted
        }
        return Object.prototype.hasOwnProperty.call(_memoryStorage, key) ? _memoryStorage[key] : null;
    },
    setItem: function(key, val) {
        var stringVal = (val === null || val === undefined) ? '' : String(val);
        _memoryStorage[key] = stringVal;
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(key, stringVal);
            }
        } catch (e) {
            // Sandboxed iframe or storage restricted
        }
    },
    removeItem: function(key) {
        delete _memoryStorage[key];
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.removeItem(key);
            }
        } catch (e) {
            // Sandboxed iframe
        }
    },
    clear: function() {
        _memoryStorage = {};
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.clear();
            }
        } catch (e) {
            // Sandboxed iframe
        }
    }
};
var gameStorage = safeStorage;
