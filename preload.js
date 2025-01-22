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
        console.log('Loading consoles from:', dataPath);

        if (!fs.existsSync(dataPath)) {
          console.error('consoles_index.json does not exist at path:', dataPath);
          return [];
        }

        const consolesData = fs.readFileSync(dataPath, 'utf-8');

        const consoles = JSON.parse(consolesData).consoles;
        console.log('Consoles loaded:', consoles.length);
        return consoles;
      } catch (error) {
        console.error('Error in getConsoles:', error);
        return [];
      }
    },
    getGamesForConsole: (consoleFile) => {
      try {
        const dataPath = path.join(__dirname, 'data', consoleFile);
        console.log('Loading games from:', dataPath);

        if (!fs.existsSync(dataPath)) {
          console.error('Console JSON file does not exist at path:', dataPath);
          return [];
        }

        const gamesData = fs.readFileSync(dataPath, 'utf-8');

        const games = JSON.parse(gamesData).Games;
        console.log('Games loaded:', games.length);
        return games;
      } catch (error) {
        console.error('Error in getGamesForConsole:', error);
        return [];
      }
    },
    launchGame: (corePath, romPath) => {
      ipcRenderer.send('launch-game', { corePath, romPath });
    }
  });

  // Expose path module functions as needed
  contextBridge.exposeInMainWorld('path', {
    join: (...args) => path.join(...args),
    dirname: (p) => path.dirname(p)
  });

  console.log('preload.js successfully loaded');
} catch (error) {
  console.error('Error in preload.js:', error);
}