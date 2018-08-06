'use strict';

var cache = {};

Object.defineProperty(global, '__stack__', {
    get: function get() {
        var orig = Error.prepareStackTrace;
        Error.prepareStackTrace = function (_, stack) {
            return stack;
        };
        var err = new Error();
        var stack = err.stack;

        Error.captureStackTrace(err, arguments.callee);

        Error.prepareStackTrace = orig;
        return stack;
    }
});

Object.defineProperty(global, '__consoleLocation__', {
    get: function get() {
        var fileName = __stack__[3].getFileName();
        var functionName = __stack__[3].getFunctionName();
        var lineNumber = __stack__[3].getLineNumber();
        var columnNumber = __stack__[3].getColumnNumber();

        var key = JSON.stringify({ fileName: fileName, functionName: functionName, lineNumber: lineNumber, columnNumber: columnNumber });

        var location = cache[key];

        if (location) {
            return location;
        }

        fileName = wrapCallSite(__stack__[3]).getFileName();
        lineNumber = wrapCallSite(__stack__[3]).getLineNumber();
        columnNumber = wrapCallSite(__stack__[3]).getColumnNumber();

        return cache[key] = { fileName: fileName, lineNumber: lineNumber, columnNumber: columnNumber, functionName: functionName };
    }
});

function wrapCallSite(frame) {
    if (frame.isNative()) return frame;

    var source = frame.getFileName() || frame.getScriptNameOrSourceURL();

    frame = cloneCallSite(frame);

    frame.getFileName = function () {
        return source;
    };

    return frame;
}

function cloneCallSite(frame) {

    var propertyNames = Object.getOwnPropertyNames(Object.getPrototypeOf(frame));

    return propertyNames.reduce(function (ret, name) {

        ret[name] = /^(?:is|get)/.test(name) ? function () {
            return frame[name].call(frame);
        } : frame[name];

        return ret;
    }, {});
}