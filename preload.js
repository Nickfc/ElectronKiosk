// preload.js

const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs').promises; // Use Promises for async operations
const path = require('path');

contextBridge.exposeInMainWorld('api', {
    // Asynchronous method to fetch consoles
    getConsoles: async () => {
        try {
            const dataPath = path.join(__dirname, 'data', 'consoles_index.json');

            // Check if the file exists
            await fs.access(dataPath);

            // Read the file asynchronously
            const consolesData = await fs.readFile(dataPath, 'utf-8');
            const consoles = JSON.parse(consolesData).consoles;
            return consoles;
        } catch (error) {
            console.error('Error in getConsoles:', error);
            // Optionally, send the error to the renderer process
            ipcRenderer.send('notify-error', 'Failed to load consoles data.');
            throw error;
        }
    },

    // Asynchronous method to fetch games for a specific console
    getGamesForConsole: async (consoleFile) => {
        try {
            const dataPath = path.join(__dirname, 'data', consoleFile);

            // Check if the file exists
            await fs.access(dataPath);

            // Read the file asynchronously
            const gamesData = await fs.readFile(dataPath, 'utf-8');
            const games = JSON.parse(gamesData).Games;

            // Add ConsoleFile property to each game
            games.forEach(game => {
                game.ConsoleFile = consoleFile;
            });

            return games;
        } catch (error) {
            console.error('Error in getGamesForConsole:', error);
            // Optionally, send the error to the renderer process
            ipcRenderer.send('notify-error', `Failed to load games for ${consoleFile}.`);
            throw error;
        }
    },

    // Method to launch a game
    launchGame: (corePath, romPath) => {
        ipcRenderer.send('launch-game', { corePath, romPath });
    },

    // Method to quit the application
    quitApp: () => {
        ipcRenderer.send('quit-app');
    },

    // Expose the application directory
    appDir: __dirname,

    // Include path functions within the api object
    path: {
        join: (...args) => path.join(...args),
        dirname: (p) => path.dirname(p),
    }
});

// Expose Gamepad API
contextBridge.exposeInMainWorld('gamepadApi', {
    getGamepads: () => navigator.getGamepads(),
});

// Listen for 'game-ended' event from main process and dispatch a custom event
ipcRenderer.on('game-ended', () => {
    window.dispatchEvent(new Event('game-ended'));
});

// Listen for error notifications and display them
ipcRenderer.on('notify-error', (event, message) => {
    window.dispatchEvent(new CustomEvent('notify-error', { detail: message }));
});

console.log('preload.js successfully loaded');
