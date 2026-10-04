const { ipcRenderer } = require('electron');

// Intercept WhatsApp Notifications and redirect to Main Process via D-Bus
window.Notification = class extends Notification {
  constructor(title, options = {}) {
    super(title, options);
    ipcRenderer.send('send-notification', {
      title: title || 'WhatsApp',
      body: options.body || ''
    });
  }
};

// Handle reply input focus request from D-Bus notification action
ipcRenderer.on('request-reply-focus', () => {
  const input = document.querySelector('div[contenteditable="true"][data-tab="10"]');
  if (input) {
    input.focus();
  }
});

// Inject Custom Title Bar once DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.textContent = `
    /* ------------------------------- */
    /* 1. CUSTOM TITLE BAR STYLES      */
    /* ------------------------------- */
    #electron-titlebar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 32px;
      background-color: #f0f2f5;
      color: #54656f;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 13px;
      user-select: none;
      -webkit-app-region: drag;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 999999;
    }

    html.dark #electron-titlebar, body.dark #electron-titlebar {
      background-color: #202c33;
      color: #aebac1;
    }

    #electron-titlebar-title {
      margin-left: 14px;
      font-weight: 500;
    }
    
    #electron-titlebar-controls {
      display: flex;
      height: 100%;
      -webkit-app-region: no-drag;
    }
    
    .ctrl-btn {
      width: 44px;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #54656f;
      font-size: 14px;
      transition: background 0.15s ease;
    }

    html.dark .ctrl-btn, body.dark .ctrl-btn { color: #aebac1; }
    .ctrl-btn:hover { background-color: #e9edef; }
    html.dark .ctrl-btn:hover, body.dark .ctrl-btn:hover { background-color: #374248; }

    .ctrl-btn#btn-close:hover {
      background-color: #ea4335 !important;
      color: #ffffff !important;
    }

    /* ------------------------------- */
    /* 2. MEDIA VIEWER OVERLAP FIX     */
    /* ------------------------------- */
    /* Push WhatsApp down by 32px and force fixed elements (like the PDF viewer) to stay inside */
    #app {
      position: absolute !important;
      top: 32px !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      height: calc(100% - 32px) !important;
      padding-top: 0 !important;
      margin-top: 0 !important;
      transform: translateZ(0) !important; 
    }
  `;
  document.head.appendChild(style);

  // Construct Titlebar Elements
  const titlebar = document.createElement('div');
  titlebar.id = 'electron-titlebar';

  const title = document.createElement('div');
  title.id = 'electron-titlebar-title';
  title.textContent = 'WhatsApp';

  const controls = document.createElement('div');
  controls.id = 'electron-titlebar-controls';

  const minBtn = document.createElement('div');
  minBtn.className = 'ctrl-btn';
  minBtn.id = 'btn-min';
  minBtn.textContent = '─';
  minBtn.onclick = () => ipcRenderer.send('window-minimize');

  const maxBtn = document.createElement('div');
  maxBtn.className = 'ctrl-btn';
  maxBtn.id = 'btn-max';
  maxBtn.textContent = '□';
  maxBtn.onclick = () => ipcRenderer.send('window-maximize');

  const closeBtn = document.createElement('div');
  closeBtn.className = 'ctrl-btn';
  closeBtn.id = 'btn-close';
  closeBtn.textContent = '✕';
  closeBtn.onclick = () => ipcRenderer.send('window-close');

  controls.appendChild(minBtn);
  controls.appendChild(maxBtn);
  controls.appendChild(closeBtn);
  titlebar.appendChild(title);
  titlebar.appendChild(controls);

  document.body.prepend(titlebar);
});