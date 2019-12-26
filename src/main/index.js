import {app, BrowserWindow, Menu} from 'electron'

/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (process.env.NODE_ENV !== 'development') {
    global.__static = require('path').join(__dirname, '/static').replace(/\\/g, '\\\\')
}

let mainWindow

const electron = require('electron');
const {ipcMain} = require('electron');
const path = require('path');
const sumorpc = require('./sumorpc');
const config = require('./config');
const Store = require('electron-store');
const store = new Store();

const fs = require('fs');
const utils = require('electron-util');

let homedir = process.env.HOME;
if (process.platform === 'win32'){
    homedir = process.env.HOMEPATH; // back-compat
    if (!fs.existsSync(path.join(homedir, 'Sumokoin')))
        homedir = process.env.USERPROFILE;
}
let sumodir = path.join(homedir, 'Sumokoin');

if (!fs.existsSync(wowdir)){
    console.log(`${wowdir} created`);
    fs.mkdirSync(wowdir);
}

// WowRPC & cfg bootstrap
let wallet = new wowrpc.SumoRpc(wowdir);
let cfg = new config.Config(wowdir);
wallet._cli_daemon_address = cfg.data.node;

const winURL = process.env.NODE_ENV === 'development' ? `http://localhost:9080` : `file://${__dirname}/index.html`
import { platform, cliPath } from './binaries';

console.log(cliPath);

function createWindow() {
    utils.enforceMacOSAppLocation();

    mainWindow = new BrowserWindow({
        height: 550,
        useContentSize: true,
        width: 950
    });

    mainWindow.setMenu(null);

    if(platform !== 'win'){
        mainWindow.setResizable(false);
    }

    mainWindow.loadURL(winURL);

    if(process.env.NODE_ENV === 'development'){
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.webContents.on("devtools-opened", () => {
            mainWindow.webContents.closeDevTools();
        });
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
        console.log('lat0rz');
    });

    if (process.platform === 'darwin') {
        const template = [
            {
                label: app.getName(),
                submenu: [
                    { role: 'about' },
                    { type: 'separator' },
                    { role: 'services', submenu: [] },
                    { type: 'separator' },
                    { role: 'hide' },
                    { role: 'hideothers' },
                    { role: 'unhide' },
                    { type: 'separator' },
                    { role: 'quit' }
                ]
            },
            {
                label: 'Edit',
                submenu: [
                    { role: 'undo' },
                    { role: 'redo' },
                    { type: 'separator' },
                    { role: 'cut' },
                    { role: 'copy' },
                    { role: 'paste' },
                    { role: 'pasteandmatchstyle' },
                    { role: 'delete' },
                    { role: 'selectall' }
                ]
            }
        ];
        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);
    }

    wallet.getEmbeddedVersion();
}

app.on('ready', createWindow)

app.on('window-all-closed', app.quit);
app.on('before-quit', () => {
    if(wallet._state !== 0){
        wallet.kill();
    }

    mainWindow.removeAllListeners('close');
    mainWindow.close();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow()
    }
});

ipcMain.on('rpc_get_embedded_version', (event) => {
    wallet.onEmbeddedVersion = (version) => {
        event.sender.send( 'embedded_version', version);
    };
    wallet.getEmbeddedVersion();

});

ipcMain.on('rpc_get_sumodir', (event, data) => {
    event.sender.send('rpc_get_sumodir', sumodir);
});

ipcMain.on('rpc_cfg_set_node', (event, node) => {
    if(cfg.selectNode(node)){
        wallet._cli_daemon_address = node;
    }
});

ipcMain.on('rpc_get_cfg', (event) => {
    event.sender.send('rpc_get_cfg', cfg.data);
});

ipcMain.on('rpc_create_wallet', (event, data) => {
    console.log('creating wallet!');
    wallet.onCreateWalletFinished = function(data){
        mainWindow.webContents.send('rpc_wallet_created' , data);
    }
    wallet.createWallet(wowdir, data.name, data.password);
    event.sender.send('rpc_wallet_creating');
});

ipcMain.on('rpc_commit_wallet', (event, data) => {
    console.log('commit wallet!');
    console.log(data);

    wallet.commitWallet(data.name);
    event.sender.send('rpc_wallet_committed');
});

ipcMain.on('rate_usd_wow', (event, data) => {
    console.log(data);
});

ipcMain.on('rpc_send_monies', (event, data) => {
    if(wallet._state <= 2){
        event.sender.send('rpc_monies_sent_error', {'message': `wallet not ready (${wallet._state})`});
    } else {
        wallet.sendMonies(data.address, data.amount);
        event.sender.send('rpc_sending_monies');
    }
});

function resetWallet(){
    if(wallet._state !== 0) {
        wallet.kill();
        wallet.onWalletOpened = null
        wallet.onWalletBalanceChanged = null;
        wallet.onWalletTxsChanged = null;
        wallet.onTransactionCompleted = null;
        wallet.onHeightRefresh = null;
        wallet.onStateChanged = null;
        wallet._setState(0);
    }

    wallet = new sumorpc.SumoRpc(sumodir);
    wallet._cli_daemon_address = cfg.data.node;
}

ipcMain.on('rpc_close_wallet', (event) => {
    resetWallet();
    event.sender.send('rpc_wallet_closed');
});

ipcMain.on('rpc_kill_wallet', (event) => {
    wallet.kill();
    resetWallet();
});

ipcMain.on('rpc_open_wallet', (event, data) => {
    wallet.onWalletOpened = function(data){
        event.sender.send('rpc_wallet_opened', data);
    }

    wallet.onWalletBalanceChanged = function(data){
        event.sender.send('rpc_balance_changed', data);
    }

    wallet.onWalletBalanceUnlockedChanged = function(data){
        event.sender.send('rpc_unlocked_changed', data);
    }

    wallet.onWalletTxsChanged = function(data){
        event.sender.send('rpc_txs_changed', data);
    }

    wallet.onTransactionCompleted = function(data){
        event.sender.send('rpc_monies_sent', data);
    }

    wallet.onHeightRefresh = function(data){
        console.log(`Height refresh: ${data.from} ${data.to}`);
        event.sender.send('rpc_height_refreshed', {'from': data.from, 'to': data.to});
    }

    wallet.onStateChanged = function(data){
        event.sender.send('rpc_state_changed', {'state': data});
    }

    wallet.onError = function(msg){
        console.log(`error, killing wallet: ${msg}`);
        wallet.kill();
        resetWallet();

        mainWindow.webContents.send('rpc_dialog_native', {
            type: 'error',
            title: 'Wallet error',
            buttons: ['OK'],
            message: `ERROR!\n\n${msg}\n\nWALLET ERROR!!!`
        });
        mainWindow.webContents.send('rpc_wallet_closed');
    }

    wallet.connect(data.path, data.password);
    event.sender.send('rpc_wallet_opening');
});

/**
 * Auto Updater
 *
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-electron-builder.html#auto-updating
 */

/*
import { autoUpdater } from 'electron-updater'

autoUpdater.on('update-downloaded', () => {
  autoUpdater.quitAndInstall()
})

app.on('ready', () => {
  if (process.env.NODE_ENV === 'production') autoUpdater.checkForUpdates()
})
 */
