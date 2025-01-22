// main.js

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    fullscreen: true, // Enable fullscreen mode
    autoHideMenuBar: true, // Hide the menu bar
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false, // Must be false
      contextIsolation: true, // Must be true
      enableRemoteModule: false, // Should be false or omitted as it’s deprecated
      sandbox: false, // Explicitly disable sandbox
    },
  });

  win.loadFile('index.html');

  // Optional: Open the DevTools for debugging
  // win.webContents.openDevTools();

  // Expose the window object globally
  global.mainWindow = win;
}

// Create the main application window when ready
app.whenReady().then(createWindow);

// Handle game launch
ipcMain.on('launch-game', (event, args) => {
  let { corePath, romPath } = args;

  // Resolve corePath and romPath to absolute paths
  corePath = path.resolve(corePath);
  romPath = path.resolve(romPath);

  // Path to the RetroArch executable
  const retroarchPath = 'C:/RetroArch/win64/retroarch.exe';

  const commandArgs = ['-L', corePath, romPath];

  // Minimize the main window
  if (global.mainWindow && !global.mainWindow.isMinimized()) {
    global.mainWindow.minimize();
  }

  const child = spawn(retroarchPath, commandArgs, { windowsHide: true });

  child.on('error', (error) => {
    console.error(`Error launching game: ${error}`);
    event.sender.send('launch-error', 'Failed to launch the game.');
    // Restore the main window if there's an error
    if (global.mainWindow && global.mainWindow.isMinimized()) {
      global.mainWindow.restore();
    }
  });

  child.on('exit', (code, signal) => {
    console.log(`Game exited with code ${code} and signal ${signal}`);
    // Notify renderer process via IPC
    event.sender.send('game-ended');
    // Restore the main window when the game exits
    if (global.mainWindow && global.mainWindow.isMinimized()) {
      global.mainWindow.restore();
    }
  });
});

// Quit the application when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});