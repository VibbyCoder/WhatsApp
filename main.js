const { app, BrowserWindow, Tray, Menu, ipcMain, session, shell, nativeImage } = require('electron');
const path = require('path');
const dbus = require('dbus-next');

let mainWindow = null;
let tray = null;
let isQuitting = false;

// Force single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// Native D-Bus Notification Integration with Inline Reply Action
async function sendDBusNotification(title, body) {
  try {
    const bus = dbus.sessionBus();
    const obj = await bus.getProxyObject('org.freedesktop.Notifications', '/org/freedesktop/Notifications');
    const notify = obj.getInterface('org.freedesktop.Notifications');

    // Register notification actions
    const actions = ['default', 'Open', 'inline-reply', 'Reply'];
    const hints = {
      'desktop-entry': new dbus.Variant('s', 'whatsapp-linux'),
      'urgency': new dbus.Variant('y', 1)
    };

    const id = await notify.Notify(
      'WhatsApp',
      0,
      path.join(__dirname, 'assets/icon.png'),
      title,
      body,
      actions,
      hints,
      5000
    );

    notify.on('ActionInvoked', (notifId, actionKey) => {
      if (notifId === id) {
        if (actionKey === 'default') {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        } else if (actionKey === 'inline-reply') {
          // Bring window forward to receive response
          if (mainWindow) {
            mainWindow.show();
            mainWindow.webContents.send('request-reply-focus');
          }
        }
      }
    });
  } catch (err) {
    // Fallback to basic notification if D-Bus service is unavailable
    const { Notification } = require('electron');
    new Notification({ title, body, icon: path.join(__dirname, 'assets/icon.png') }).show();
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    frame: false, // Frameless window to remove default File/Edit menu
    icon: path.join(__dirname, 'assets/icon.png'),
    backgroundColor: '#111b21',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: false,
      nodeIntegration: false, // Changed to false to prevent WhatsApp from crashing
      sandbox: false,         // Allows preload.js to still use ipcRenderer
      spellcheck: true
    }
  });

  // Remove top menu bar entirely
  Menu.setApplicationMenu(null);

  // Modern Linux Chrome User Agent to guarantee full WhatsApp Web compatibility
  mainWindow.loadURL('https://web.whatsapp.com', {
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
  });

  // Keep all navigation and file interactions inside the app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://web.whatsapp.com') || url.startsWith('blob:')) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // In-app file download handling
  session.defaultSession.on('will-download', (event, item) => {
    item.on('updated', (event, state) => {
      if (state === 'interrupted') {
        console.log('Download interrupted');
      }
    });
  });

  // Background Sync: intercept close to hide into tray
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets/icon.png')).resize({ width: 24, height: 24 });
  tray = new Tray(icon);
  tray.setToolTip('WhatsApp Linux');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open WhatsApp',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
}

// Window control IPC handlers
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('window-close', () => mainWindow?.hide());
ipcMain.on('send-notification', (_, { title, body }) => sendDBusNotification(title, body));

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});