var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _getOwnPropertyNames = require('babel-runtime/core-js/object/get-own-property-names');

var _getOwnPropertyNames2 = _interopRequireDefault(_getOwnPropertyNames);

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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

        var key = (0, _stringify2.default)({ fileName: fileName, functionName: functionName, lineNumber: lineNumber, columnNumber: columnNumber });

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

    var propertyNames = (0, _getOwnPropertyNames2.default)((0, _getPrototypeOf2.default)(frame));

    return propertyNames.reduce(function (ret, name) {

        ret[name] = /^(?:is|get)/.test(name) ? function () {
            return frame[name].call(frame);
        } : frame[name];

        return ret;
    }, {});
}