const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');

let mainWindow;

/**
 * Extract permanent hardware UUID from Windows / Linux / macOS
 */
function getHardwareUUID() {
  try {
    const platform = os.platform();
    let rawUUID = '';

    if (platform === 'win32') {
      try {
        // Query motherboard / CSPRODUCT UUID
        const output = execSync('wmic csproduct get uuid', { timeout: 3000, encoding: 'utf8' });
        const lines = output.trim().split('\n');
        if (lines.length > 1) {
          rawUUID = lines[1].trim();
        }
      } catch (e) {
        // fallback to disk drive serial
        try {
          const diskOut = execSync('wmic diskdrive get serialnumber', { timeout: 3000, encoding: 'utf8' });
          const diskLines = diskOut.trim().split('\n');
          if (diskLines.length > 1) rawUUID = diskLines[1].trim();
        } catch (e2) {}
      }
    } else if (platform === 'darwin') {
      try {
        const macOut = execSync("ioreg -rd1 -c IOPlatformExpertDevice | grep -E '(IOPlatformUUID)'", { timeout: 3000, encoding: 'utf8' });
        rawUUID = macOut.split('" = "')[1]?.replace('"', '').trim();
      } catch (e) {}
    } else {
      // Linux
      try {
        if (fs.existsSync('/etc/machine-id')) {
          rawUUID = fs.readFileSync('/etc/machine-id', 'utf8').trim();
        }
      } catch (e) {}
    }

    if (!rawUUID || rawUUID.toLowerCase() === 'none' || rawUUID.length < 5) {
      // fallback to network mac address + cpu model hash
      const networkInterfaces = os.networkInterfaces();
      const macs = Object.values(networkInterfaces).flat().map(i => i?.mac).filter(Boolean).join('');
      rawUUID = `HW-${os.cpus()[0]?.model}-${macs}-${os.hostname()}`;
    }

    // Produce compact clean ID: ID-XXXXXXXX
    const hash = crypto.createHash('sha256').update(rawUUID + 'MARO-SALT-2026').digest('hex').toUpperCase();
    return `ID-${hash.substring(0, 9)}`;
  } catch (err) {
    return `ID-FALLBACK-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    title: 'MARO Lite - برنامج المحاسبة وإدارة نقاط البيع ERP',
    icon: path.join(__dirname, '../public/favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true
    },
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#0F172A'
  });

  // Load from local dist or server
  const distPath = path.join(__dirname, '../dist/index.html');
  if (fs.existsSync(distPath)) {
    mainWindow.loadFile(distPath);
  } else {
    mainWindow.loadURL('http://localhost:3000');
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('get-hardware-uuid', () => {
  return getHardwareUUID();
});

ipcMain.handle('print-thermal-receipt', async (event, contentHtml) => {
  if (!mainWindow) return { success: false, error: 'No active window' };
  
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false
    }
  });

  await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(contentHtml)}`);
  
  return new Promise((resolve) => {
    printWindow.webContents.print({
      silent: true,
      printBackground: true,
      deviceName: '' // default printer
    }, (success, failureReason) => {
      printWindow.close();
      if (success) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: failureReason });
      }
    });
  });
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
