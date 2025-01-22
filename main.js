// main.js

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { execFile } = require('child_process');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,      // Must be false
      contextIsolation: true,      // Must be true
      enableRemoteModule: false,   // Should be false or omitted as it’s deprecated
      sandbox: false               // Ensure sandbox is disabled (default)
    }
  });

  win.loadFile('index.html');

  // Optional: Open the DevTools for debugging
  // win.webContents.openDevTools();
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
  const retroarchPath = 'C:/RetroArch/win64/retroarch.exe'; // Updated path

  const commandArgs = [
    '-L',
    corePath,
    romPath
  ];

  execFile(retroarchPath, commandArgs, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error launching game: ${error}`);
      event.sender.send('launch-error', 'Failed to launch the game.');
      return;
    }
    console.log(`Game launched successfully.`);
  });
});

// Quit the application when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});