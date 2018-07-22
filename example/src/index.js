const createConsole = require('console-with-explain')

window.console = createConsole()


function abc() {
    console.log(444);
}

abc();
