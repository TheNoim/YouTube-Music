/**
 * Created by nilsbergmann on 04.02.17.
 */
const winston = require("winston");
const ElectronConsole = require('winston-electron');

module.exports = function (nocolors) {
    return new winston.Logger({
        transports: [
            new ElectronConsole({
                level: 'info',
                handleExceptions: false,
                levels: {
                    trace: 0,
                    input: 1,
                    verbose: 2,
                    prompt: 3,
                    debug: 4,
                    info: 5,
                    data: 6,
                    help: 7,
                    warn: 8,
                    error: 9
                },
                colors: {
                    trace: 'magenta',
                    input: 'grey',
                    verbose: 'cyan',
                    prompt: 'grey',
                    debug: 'blue',
                    info: 'green',
                    data: 'grey',
                    help: 'cyan',
                    warn: 'yellow',
                    error: 'red'
                },
                colorize: !nocolors
            })
        ]
    });
};