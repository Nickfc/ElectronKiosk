const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    frame: false,        // no title bar
    fullscreen: true,    // entire screen
    kiosk: true,         // can't close/minimize easily
    alwaysOnTop: true,   // keep kiosk above other windows
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  // mainWindow.webContents.openDevTools(); // For debugging if needed
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Listen for "launch-game" from renderer, spawn RetroArch
ipcMain.on('launch-game', (event, game) => {
  console.log(`[MAIN] Launching game: ${game.Title}`);
  
  // Path to RetroArch (adjust if necessary)
  const retroarchExe = 'C:/RetroArch/win64/retroarch.exe';

  // If multiple disks, picking the first ROM for simplicity:
  const romPath = game.RomPaths[0];
  if (!romPath) {
    console.error('No ROM path found for this game!');
    return;
  }

  // Build arguments: -L <core> <rom>, plus optional extra
  const args = ['-L', game.CorePath, romPath];
  if (game.LaunchArguments) {
    args.push(...game.LaunchArguments.split(' '));
  }

  console.log(`Spawning RetroArch with args: ${args.join(' ')}`);
  const proc = spawn(retroarchExe, args, {
    detached: false,
    stdio: 'ignore'
  });

  // Minimize kiosk so RetroArch has focus
  mainWindow.minimize();

  proc.on('close', (code) => {
    console.log(`RetroArch closed with code ${code}`);
    // Restore kiosk
    mainWindow.show();
    mainWindow.focus();
  });
});
