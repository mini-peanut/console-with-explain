const path = require("path");
const SourceMapConsumer = require('source-map').SourceMapConsumer;
const sourceMapCache = {};
const fileContentsCache = {};
const reSourceMap = /^data:application\/json[^,]+base64,/;

export function wrapCallSite(frame) {
    // Most call sites will return the source file from getFileName(), but code
    // passed to eval() ending in "//# sourceURL=..." will return the source file
    // from getScriptNameOrSourceURL() instead
    if (frame.isNative()) return frame;

    const source = frame.getFileName() || frame.getScriptNameOrSourceURL();

    let position;
    if (source) {
        const line = frame.getLineNumber();
        const column = frame.getColumnNumber() - 1;
        position = mapSourcePosition({
            source: source,
            line: line,
            column: column
        });

        console.log(position)
        frame = cloneCallSite(frame);
        frame.getFileName = function() { return position.source.replace(/\?.*$/, ''); };
        frame.getLineNumber = function() { return position.line; };
        frame.getColumnNumber = function() { return position.column ? position.column + 1 : column; };
        frame.getScriptNameOrSourceURL = function() { return position.source; };
        return frame;
    }



    // Code called using eval() needs special handling
    const origin = frame.isEval() && frame.getEvalOrigin();
    if (origin) {
        // ln and cn in eval
        const ln = frame.getLineNumber();
        const cn = frame.getColumnNumber();
        position = getEvalPosition(origin, ln, cn);
        frame = cloneCallSite(frame);
        frame.getScriptNameOrSourceURL = function() { return position.source.replace(/\?.*$/, ''); };
        frame.getLineNumber = function() { return position.line; };
        frame.getColumnNumber = function() { return position.column ? position.column + 1: cn; };
        frame.getEvalOrigin = function() { return origin; };
        frame.getFileName = function () { return position.source}
        return frame;
    }

    // If we get here then we were unable to change the source position
    return frame;
}

function cloneCallSite(frame) {
    const object = {};
    Object.getOwnPropertyNames(Object.getPrototypeOf(frame)).forEach(function(name) {
        object[name] = /^(?:is|get)/.test(name) ? function() { return frame[name].call(frame); } : frame[name];
    });
    object.toString = CallSiteToString;

    return object;
}


function getEvalPosition(origin, ln, cn) {
    // Most eval() calls are in this format
    var match = /^eval at ([^(]+) \((.+):(\d+):(\d+)\)$/.exec(origin);

    if (match) {
        var position = mapSourcePosition({
            source: match[2],
            line: match[3],
            column: match[4] - 1,
            eval:[ln, cn]
        });

        return position
    }

    // Parse nested eval() calls using recursion
    match = /^eval at ([^(]+) \((.+)\)$/.exec(origin);
    if (match) {
        return getEvalPosition(match[2]);
    }

    // Make sure we still return useful information if we didn't find anything
    return origin;
}

// This is copied almost verbatim from the V8 source code at
// https://code.google.com/p/v8/source/browse/trunk/src/messages.js. The
// implementation of wrapCallSite() used to just forward to the actual source
// code of CallSite.prototype.toString but unfortunately a new release of V8
// did something to the prototype chain and broke the shim. The only fix I
// could find was copy/paste.
function CallSiteToString() {
    var fileName;
    var fileLocation = '';
    if (this.isNative()) {
        fileLocation = 'native';
    } else {
        fileName = this.getScriptNameOrSourceURL();
        if (!fileName && this.isEval()) {
            fileLocation = this.getEvalOrigin();
            fileLocation += ', ';  // Expecting source position to follow.
        }
        if (fileName && !/^\w+:\/\//.test(fileName)) {
            var root = location.protocol + '//' + location.host
            fileName = root + (/^\//.test(fileName) ? fileName : '/' + fileName)
        }

        if (fileName) {
            fileLocation += fileName;
        } else {
            // Source code does not originate from a file and is not native, but we
            // can still get the source position inside the source string, e.g. in
            // an eval string.
            fileLocation += '<anonymous>';
        }
        var lineNumber = this.getLineNumber();
        if (lineNumber != null) {
            fileLocation += ':' + lineNumber;
            var columnNumber = this.getColumnNumber();
            if (columnNumber) {
                fileLocation += ':' + columnNumber;
            }
        }
    }
}

function supportRelativeURL(file, url) {
    if (!file) return url;
    var dir = path.dirname(file);
    var match = /^\w+:\/\/[^\/]*/.exec(dir);
    var protocol = match ? match[0] : '';
    return protocol + path.resolve(dir.slice(protocol.length), url);
}

function retrieveFile(path) {
    // Trim the path to make sure there is no extra whitespace.
    path = path.trim();
    if (path in fileContentsCache) {
        return fileContentsCache[path];
    }

    if (/^\S+:\/\//.test(path) && !/^http(s)?:\/\//.test(path)) {
        return null
    }

    try {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', path, false);
        xhr.send(null);
        var contents = null
        if (xhr.readyState === 4 && xhr.status === 200) {
            contents = xhr.responseText
        }

    } catch (e) {
        contents = null;
    }

    return fileContentsCache[path] = contents;
}


function retrieveSourceMap(source, position) {
    if (/^script:\/\/$/.test(source)) return null;
    var sourceMappingURL = retrieveSourceMapURL(source, position);
    if (!sourceMappingURL) return null;

    // Read the contents of the source map
    var sourceMapData;
    if (reSourceMap.test(sourceMappingURL)) {
        // Support source map URL as a data url
        var rawData = sourceMappingURL.slice(sourceMappingURL.indexOf(',') + 1);
        sourceMapData = new Buffer(rawData, 'base64').toString();
        sourceMapData = JSON.parse(sourceMapData)
        source = sourceMapData.sources[0]
        sourceMappingURL = null;
    } else {
        // Support source map URLs relative to the source URL
        sourceMappingURL = supportRelativeURL(source, sourceMappingURL);
        sourceMapData = retrieveFile(sourceMappingURL);
    }

    if (!sourceMapData) {
        return null;
    }

    return {
        url: sourceMappingURL,
        map: sourceMapData
    };
}

function retrieveSourceMapURL(source, position) {
    var fileData = fileContentsCache[source];
    if (!fileData) {
        try {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', source, false);
            xhr.send(null);
            if (xhr.readyState === 4 && xhr.status === 200) {
                fileData = xhr.responseText;
                fileContentsCache[source] = fileData;
            }
            if (xhr.status !== 200) return null
        } catch (e) { return null }

        // Support providing a sourceMappingURL via the SourceMap header
        var sourceMapHeader = xhr.getResponseHeader('SourceMap') ||
            xhr.getResponseHeader('X-SourceMap');
        if (sourceMapHeader) {
            return sourceMapHeader;
        }
    }

    var re = /(?:\/\/[@#][ \t]+sourceMappingURL=([^\s'"]+?)[ \t]*$)|(?:\/\*[@#][ \t]+sourceMappingURL=([^\*]+?)[ \t]*(?:\*\/)[ \t]*$)/mg;
    // Keep executing the search to find the *last* sourceMappingURL to avoid
    // picking up sourceMappingURLs from comments, strings, etc.
    var lastMatch, match;
    while (match = re.exec(fileData)) lastMatch = match; // eslint-disable-line
    if (!lastMatch) {
        var line = fileData.split(/(?:\r\n|\r|\n)/)[position.line - 1];
        line = line.replace(/^.*sourceMappingURL=/, '').replace(/"\s*\);\s*$/,'')
        if (reSourceMap.test(line)) return line;
        return null;
    }
    return lastMatch[1];
}

function getMapPath (stacks, params = {}) {
    for (let i = 0; i < stacks.length; i++) {
        let stack = stacks[i];
        console.log(stack, wrapCallSite(stack).getFileName());
        if (stack.html){
            continue
        }
        let mapName = params.mapName;
        let basename = path.basename(stack.filepath)
        let dirname = path.dirname(stack.filepath)
        let arr = basename.split('.');
        if (arr.length === 2) {
            mapName = mapName.replace(/\[name\]/g, arr[0])
        } else if (arr.length === 3) {
            mapName = mapName.replace(/\[name\]/g, arr[0])
            mapName = mapName.replace(/\[hash\]/g, arr[1])
        }
        if (params.mapUrl) {
            stack.mapUrl = params.mapUrl + '/' + mapName
        } else {
            stack.mapUrl = dirname + '/' + mapName
        }
    }
}

function mapSourcePosition(position) {
    var sourceMap = sourceMapCache[position.source];
    if (!sourceMap) {
        // Call the (overrideable) retrieveSourceMap function to get the source map.
        var urlAndMap = retrieveSourceMap(position.source, position);
        if (urlAndMap) {
            var source = urlAndMap.url ? position.source : urlAndMap.map.sources[0]
            position.source = source
            sourceMap = sourceMapCache[source] = {
                url: urlAndMap.url,
                map: new SourceMapConsumer(urlAndMap.map)
            };

            // Load all sources stored inline with the source map into the file cache
            // to pretend like they are already loaded. They may not exist on disk.
            if (sourceMap.map.sourcesContent) {
                sourceMap.map.sources.forEach(function(source, i) {
                    var contents = sourceMap.map.sourcesContent[i];
                    if (contents) {
                        var url = supportRelativeURL(sourceMap.url, source);
                        fileContentsCache[url] = contents;
                    }
                });
            }
        } else {
            sourceMap = sourceMapCache[position.source] = {
                url: null,
                map: null
            };
        }
    }

    // Resolve the source URL relative to the URL of the source map
    if (sourceMap && sourceMap.map) {
        var pos
        if (position.eval) {
            pos = {
                line: position.eval[0],
                column: position.eval[1]
            }
        } else {
            pos = {
                line: position.line,
                column: position.column
            }
        }

        var originalPosition = sourceMap.map.originalPositionFor(pos);

        // Only return the original position if a matching line was found. If no
        // matching line is found then we return position instead, which will cause
        // the stack trace to print the path and line for the compiled file. It is
        // better to give a precise location in the compiled file than a vague
        // location in the original file.
        if (originalPosition.source !== null) {
            originalPosition.source = supportRelativeURL(
                sourceMap.url, originalPosition.source);
            return originalPosition;
        }
    }

    return position;
}