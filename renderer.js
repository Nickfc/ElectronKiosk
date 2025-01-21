const fs = require('fs');
const path = require('path');
const { ipcRenderer } = require('electron');

let allGames = [];
let currentFilters = {
  console: null,
  genre: null,
};

// For gamepad navigation
let focusSection = 'console'; // 'console', 'genre', or 'games'
let indices = {
  console: 0,
  genre: 0,
  game: 0,
};
let prevGamepadButtons = [];

// Cached DOM elements
let consoleContainer, genreContainer, gameContainer, clearFiltersBtn;

document.addEventListener('DOMContentLoaded', () => {
  // Cache DOM elements
  consoleContainer = document.getElementById('console-filters');
  genreContainer = document.getElementById('genre-filters');
  gameContainer = document.getElementById('game-list');
  clearFiltersBtn = document.getElementById('clear-filters');

  // Load the game library
  loadGames();

  // Build filter buttons
  buildConsoleFilters();
  buildGenreFilters();

  // Render initial game list
  applyFilters();

  // Event listeners
  clearFiltersBtn.addEventListener('click', clearFilters);

  // Start gamepad polling
  requestAnimationFrame(gamepadLoop);
});

// Load the scanned JSON library
function loadGames() {
  try {
    const dataPath = path.join(__dirname, 'data', 'games_scanned.json');
    if (!fs.existsSync(dataPath)) {
      console.error('games_scanned.json not found. Have you run your crawler?');
      return;
    }
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    allGames = data.Games || [];
  } catch (error) {
    console.error('Error loading games:', error);
  }
}

// Build console filter buttons
function buildConsoleFilters() {
  consoleContainer.innerHTML = '';
  const uniqueConsoles = Array.from(new Set(allGames.map(g => g.Console))).sort();

  uniqueConsoles.forEach((consoleName, idx) => {
    const btn = document.createElement('div');
    btn.className = 'filter-button';
    btn.textContent = consoleName;
    btn.dataset.index = idx;

    // Click handler
    btn.addEventListener('click', () => {
      currentFilters.console = consoleName;
      indices.console = idx;
      applyFilters();
      updateUIFocus();
    });

    consoleContainer.appendChild(btn);
  });
}

// Build genre filter buttons
function buildGenreFilters() {
  genreContainer.innerHTML = '';
  const uniqueGenres = Array.from(new Set(allGames.map(g => g.Genre || 'Unknown'))).sort();

  uniqueGenres.forEach((genreName, idx) => {
    const btn = document.createElement('div');
    btn.className = 'filter-button';
    btn.textContent = genreName;
    btn.dataset.index = idx;

    btn.addEventListener('click', () => {
      currentFilters.genre = genreName;
      indices.genre = idx;
      applyFilters();
      updateUIFocus();
    });

    genreContainer.appendChild(btn);
  });
}

// Apply current filters and render game list
function applyFilters() {
  let filteredGames = [...allGames];

  if (currentFilters.console) {
    filteredGames = filteredGames.filter(g => g.Console === currentFilters.console);
  }
  if (currentFilters.genre) {
    filteredGames = filteredGames.filter(g => g.Genre === currentFilters.genre);
  }

  renderGameList(filteredGames);
}

// Render the game list
function renderGameList(games) {
  gameContainer.innerHTML = '';

  if (!games.length) {
    gameContainer.innerHTML = '<p>No games match these filters.</p>';
    return;
  }

  games.forEach((game, idx) => {
    const item = document.createElement('div');
    item.className = 'game-item';
    item.textContent = `${game.Title}${game.DiskCount > 1 ? ` (Disks: ${game.DiskCount})` : ''}`;
    item.dataset.index = idx;

    item.addEventListener('click', () => {
      indices.game = idx;
      launchGame(game);
    });

    gameContainer.appendChild(item);
  });

  // Reset game index if necessary
  if (indices.game >= games.length) {
    indices.game = games.length - 1;
  }

  updateUIFocus();
}

// Launch the selected game
function launchGame(game) {
  ipcRenderer.send('launch-game', game);
}

// Clear all filters
function clearFilters() {
  currentFilters.console = null;
  currentFilters.genre = null;
  indices.console = 0;
  indices.genre = 0;
  indices.game = 0;
  focusSection = 'console';
  applyFilters();
  updateUIFocus();
}

// Gamepad Navigation
function gamepadLoop() {
  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  if (gamepads) {
    for (const gp of gamepads) {
      if (!gp) continue;
      handleGamepad(gp);
    }
  }
  requestAnimationFrame(gamepadLoop);
}

function handleGamepad(gp) {
  const buttons = gp.buttons.map(b => b.pressed);
  const axes = gp.axes.map(a => parseFloat(a.toFixed(2)));

  function wasPressed(btnIndex) {
    return buttons[btnIndex] && !prevGamepadButtons[btnIndex];
  }

  const up = wasPressed(12) || axes[1] < -0.5;
  const down = wasPressed(13) || axes[1] > 0.5;
  const left = wasPressed(14) || axes[0] < -0.5;
  const right = wasPressed(15) || axes[0] > 0.5;
  const a = wasPressed(0);
  const b = wasPressed(1);

  if (focusSection === 'console') {
    handleFilterNavigation(consoleContainer, 'console', up, down, left, right, a, b);
  } else if (focusSection === 'genre') {
    handleFilterNavigation(genreContainer, 'genre', up, down, left, right, a, b);
  } else if (focusSection === 'games') {
    handleGameListNavigation(gameContainer, up, down, left, right, a, b);
  }

  prevGamepadButtons = buttons;
}

function handleFilterNavigation(containerEl, section, up, down, left, right, a, b) {
  const items = containerEl.querySelectorAll('.filter-button');
  if (!items.length) return;

  let idxVar = indices[section];

  // Move up/down
  if (up) {
    idxVar = (idxVar - 1 + items.length) % items.length;
  } else if (down) {
    idxVar = (idxVar + 1) % items.length;
  }

  // Move left/right to switch sections
  if (left) {
    if (section === 'genre') {
      focusSection = 'console';
    }
  } else if (right) {
    if (section === 'console') {
      focusSection = 'genre';
    } else if (section === 'genre') {
      focusSection = 'games';
    }
  }

  // Press A => set filter
  if (a) {
    const selectedEl = items[idxVar];
    if (selectedEl) {
      selectedEl.click();
    }
  }

  // Press B => clear the filter for this section
  if (b) {
    currentFilters[section] = null;
    indices[section] = 0;
    applyFilters();
    updateUIFocus();
  }

  // Update index
  indices[section] = idxVar;
  updateUIFocus();
}

function handleGameListNavigation(containerEl, up, down, left, right, a, b) {
  const items = containerEl.querySelectorAll('.game-item');
  if (!items.length) return;

  let idxVar = indices.game;

  // Move up/down
  if (up) {
    idxVar = (idxVar - 1 + items.length) % items.length;
  } else if (down) {
    idxVar = (idxVar + 1) % items.length;
  }

  // Left -> go back to 'genre'
  if (left) {
    focusSection = 'genre';
  }

  // A => launch the selected game
  if (a) {
    const selectedEl = items[idxVar];
    if (selectedEl) {
      const game = getFilteredGames()[idxVar];
      if (game) {
        launchGame(game);
      }
    }
  }

  // B => go back to 'genre'
  if (b) {
    focusSection = 'genre';
  }

  // Update index
  indices.game = idxVar;
  updateUIFocus();
}

// Get the currently filtered games
function getFilteredGames() {
  let filteredGames = [...allGames];

  if (currentFilters.console) {
    filteredGames = filteredGames.filter(g => g.Console === currentFilters.console);
  }
  if (currentFilters.genre) {
    filteredGames = filteredGames.filter(g => g.Genre === currentFilters.genre);
  }

  return filteredGames;
}

// Update UI focus and selection
function updateUIFocus() {
  // Clear all active and selected classes
  document.querySelectorAll('.filter-button, .game-item').forEach(el => {
    el.classList.remove('active', 'selected');
  });

  // Highlight selected filters
  if (currentFilters.console) {
    consoleContainer.querySelectorAll('.filter-button').forEach(btn => {
      if (btn.textContent === currentFilters.console) {
        btn.classList.add('selected');
      }
    });
  }
  if (currentFilters.genre) {
    genreContainer.querySelectorAll('.filter-button').forEach(btn => {
      if (btn.textContent === currentFilters.genre) {
        btn.classList.add('selected');
      }
    });
  }

  // Highlight focused item
  if (focusSection === 'console') {
    const items = consoleContainer.querySelectorAll('.filter-button');
    if (items[indices.console]) items[indices.console].classList.add('active');
  } else if (focusSection === 'genre') {
    const items = genreContainer.querySelectorAll('.filter-button');
    if (items[indices.genre]) items[indices.genre].classList.add('active');
  } else if (focusSection === 'games') {
    const items = gameContainer.querySelectorAll('.game-item');
    if (items[indices.game]) items[indices.game].classList.add('active');
  }
}