/**
 * Created by nilsbergmann on 03.02.17.
 */
const {app, BrowserWindow, ipcMain} = require('electron');
const {Socket, Transport} = require('electron-ipc-socket');
const url = require('url');
const path = require('path');
const MainSocketEvents = require('./MainSocketEvents');
const isDev = require('electron-is-dev');
require('electron-debug')();
const log = require('./Logger')();
const Express = require('./Express');
const NeDB = require('nedb');
const fs = require('fs-extra');

let mainWindow;

/**
 * @description Creates a new main window
 */
function createWindow(db) {


    const ex = Express(db);

    mainWindow = new BrowserWindow({width: 1400, height: 800});
    mainWindow.loadURL(url.format({
        pathname: path.join(path.join(__dirname, 'html/'), 'index.html'),
        protocol: 'file:',
        slashes: true
    }));
    mainWindow.on('closed', function () {
        mainWindow = null;
        ex.close();
    });
    if (isDev) {
        log.info("Electron is running in developer mode");
        mainWindow.webContents.openDevTools();
    }
    const socket = Socket('main', Transport(ipcMain, mainWindow));
    socket.open();
    MainSocketEvents({
        socket: socket,
        mainWindow: mainWindow,
        db: db
    });

}

function bootStrap() {

    log.info(path.join(app.getPath('userData'), 'Database.db'));

    const db = new NeDB({
        filename: path.join(app.getPath('userData'), 'Database.db'),
        autoload: true
    });

    fs.ensureDir(path.join(app.getPath('userData'), 'downloads/'), (err) => {
        if (err) throw err;
        db.ensureIndex({fieldName: 'audio'}, (error) => {
            if (error) throw error;
            db.ensureIndex({fieldName: 'playlist'}, (error) => {
                if (error) throw error;
                createWindow(db);
            });
        });
    });
}


app.on('ready', bootStrap);
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit()
    }
});
app.on('activate', function () {
    if (mainWindow === null) {
        bootStrap();
    }
});