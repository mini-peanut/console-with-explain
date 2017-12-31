const wrapCallSite = require('./wrapCallSite');
Object.defineProperty(global, '__stack', {
    get: function() {
        const orig = Error.prepareStackTrace;
        Error.prepareStackTrace = function(_, stack) {
            return stack;
        };
        const err = new Error;
        const stack = err.stack;

        Error.captureStackTrace(err, arguments.callee);

        Error.prepareStackTrace = orig;
        return stack;
    }
});

Object.defineProperty(global, '__line', {
    get: function() {
        return wrapCallSite(__stack[3]).getLineNumber();
    }
});

Object.defineProperty(global, '__function', {
    get: function() {
        return __stack[3].getFunctionName();
    }
});

Object.defineProperty(global, '__fileName', {
    get: function() {
        return wrapCallSite(__stack[3]).getFileName().substr(31);
    }
});


