/**
 * Created by nilsbergmann on 03.02.17.
 */
const {app, BrowserWindow, ipcMain} = require('electron');
const {Socket, Transport} = require('electron-ipc-socket');
const url = require('url');
const path = require('path');
const MainSocketEvents = require('./MainSocketEvents');

let mainWindow;

/**
 * @description Creates a new main window
 */
function createWindow() {
    mainWindow = new BrowserWindow({width: 1400, height: 800});
    mainWindow.loadURL(url.format({
        pathname: path.join(path.join(__dirname, 'html/'), 'index.html'),
        protocol: 'file:',
        slashes: true
    }));
    mainWindow.on('closed', function () {
        mainWindow = null;
    });
    const socket = Socket('main', Transport(ipcMain, mainWindow));
    socket.open();
    MainSocketEvents({
        socket: socket,
        mainWindow: mainWindow
    });
}

app.on('ready', createWindow);
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit()
    }
});
app.on('activate', function () {
    if (mainWindow === null) {
        createWindow();
    }
});