require('./stack');


module.exports = {
    log(...args) {
        args = args.map(item => {
            if (isPlainObject(item)) {
                return Object.entries(item).reduce((ret, next) => ret + ' ' + next.join(': '), '');
            }

            return item;
        });

        console.log.apply(console, [ `${__fileName}:第${__line}行 ${__function}函数`, ...args]);
    }
};


function isPlainObject(obj) {
    return obj ? typeof obj === 'object' && Object.getPrototypeOf(obj) === Object.prototype : false;
}