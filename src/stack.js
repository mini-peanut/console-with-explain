const cache = {};


Object.defineProperty(global, '__stack__', {
    get: function () {
        const orig = Error.prepareStackTrace;
        Error.prepareStackTrace = function (_, stack) {
            return stack;
        };
        const err = new Error;
        const stack = err.stack;

        Error.captureStackTrace(err, arguments.callee);

        Error.prepareStackTrace = orig;
        return stack;
    }
});

Object.defineProperty(global, '__consoleLocation__', {
    get: function () {
        let fileName = __stack__[3].getFileName();
        let functionName = __stack__[3].getFunctionName();
        let lineNumber = __stack__[3].getLineNumber();
        let columnNumber = __stack__[3].getColumnNumber();

        const key = JSON.stringify({fileName, functionName, lineNumber, columnNumber});

        let location = cache[key];

        if (location) {
            return location;
        }


        fileName = wrapCallSite(__stack__[3]).getFileName();
        lineNumber = wrapCallSite(__stack__[3]).getLineNumber();
        columnNumber = wrapCallSite(__stack__[3]).getColumnNumber();


        return cache[key] = {fileName, lineNumber, columnNumber, functionName};
    }
});


function wrapCallSite(frame) {
    if (frame.isNative()) return frame;

    const source = frame.getFileName() || frame.getScriptNameOrSourceURL();

    frame = cloneCallSite(frame);

    frame.getFileName = function () {
        return source;
    };

    return frame;
}

function cloneCallSite(frame) {

    const propertyNames = Object.getOwnPropertyNames(Object.getPrototypeOf(frame));

    return propertyNames.reduce((ret, name) => {

        ret[name] = /^(?:is|get)/.test(name) ? function () {
            return frame[name].call(frame);
        } : frame[name];

        return ret;
    }, {});
}

