// preload.js
try {
    const { contextBridge, ipcRenderer } = require('electron');
    const fs = require('fs');
    const path = require('path');
  
    // Expose APIs to the renderer process
    contextBridge.exposeInMainWorld('api', {
      getConsoles: () => {
        try {
          const dataPath = path.join(__dirname, 'data', 'consoles_index.json');
  
          if (!fs.existsSync(dataPath)) {
            throw new Error('Consoles data file does not exist.');
          }
  
          const consolesData = fs.readFileSync(dataPath, 'utf-8');
          const consoles = JSON.parse(consolesData).consoles;
          return consoles;
        } catch (error) {
          console.error('Error in getConsoles:', error);
          throw error;
        }
      },
      getGamesForConsole: (consoleFile) => {
        try {
          const dataPath = path.join(__dirname, 'data', consoleFile);
  
          if (!fs.existsSync(dataPath)) {
            throw new Error('Console JSON file does not exist.');
          }
  
          const gamesData = fs.readFileSync(dataPath, 'utf-8');
          const games = JSON.parse(gamesData).Games;
          return games;
        } catch (error) {
          console.error('Error in getGamesForConsole:', error);
          throw error;
        }
      },
      launchGame: (corePath, romPath) => {
        ipcRenderer.send('launch-game', { corePath, romPath });
      },
      appDir: __dirname // Expose the application directory
    });
  
    // Expose path module functions as needed
    contextBridge.exposeInMainWorld('path', {
      join: (...args) => path.join(...args),
      dirname: (p) => path.dirname(p)
    });
  
    // Listen for 'game-ended' event from main process and dispatch a custom event
    ipcRenderer.on('game-ended', () => {
      window.dispatchEvent(new Event('game-ended'));
    });
  
    console.log('preload.js successfully loaded');
  } catch (error) {
    console.error('Error in preload.js:', error);
  }