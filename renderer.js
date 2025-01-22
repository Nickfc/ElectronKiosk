// renderer.js
window.addEventListener('DOMContentLoaded', () => {
    const consoleSelect = document.getElementById('consoleSelect');
    const gameList = document.getElementById('gameList');
    const searchInput = document.getElementById('searchInput');
  
    const gameTitle = document.getElementById('gameTitle');
    const gameCover = document.getElementById('gameCover');
    const gameDescription = document.getElementById('gameDescription');
    const launchButton = document.getElementById('launchButton');
  
    let allGames = [];
    let displayedGames = [];
    let selectedGame = null;
  
    // Populate consoles dropdown
    const consoles = window.api.getConsoles();
    consoles.forEach((console) => {
      const option = document.createElement('option');
      option.value = console.file;
      option.textContent = `${console.console} (${console.count})`;
      consoleSelect.appendChild(option);
    });
  
    // Event listener for console selection
    consoleSelect.addEventListener('change', () => {
      const consoleFile = consoleSelect.value;
      if (consoleFile) {
        const games = window.api.getGamesForConsole(consoleFile);
        allGames = games;
        displayGameList(games);
        resetGameDetails();
      } else {
        gameList.innerHTML = '';
        allGames = [];
        resetGameDetails();
      }
    });
  
    // Debounce function to limit the rate at which a function can fire.
    function debounce(func, wait) {
      let timeout;
      return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          func.apply(this, args);
        }, wait);
      };
    }
  
    // Event listener for search input with debounce
    searchInput.addEventListener(
      'input',
      debounce(() => {
        const query = searchInput.value.toLowerCase();
        const filteredGames = allGames.filter((game) =>
          game.Title.toLowerCase().includes(query)
        );
        displayGameList(filteredGames);
        resetGameDetails();
      }, 300)
    );
  
    // Function to display game list
    function displayGameList(games) {
      gameList.innerHTML = '';
      displayedGames = games;
  
      games.forEach((game, index) => {
        const li = document.createElement('li');
        li.textContent = game.Title;
        li.dataset.index = index;
        gameList.appendChild(li);
      });
    }
  
    // Function to reset game details
    function resetGameDetails() {
      gameTitle.textContent = 'Select a game';
      gameDescription.textContent = '';
      gameCover.src = '';
      launchButton.disabled = true;
      selectedGame = null;
  
      // Remove selection from game list
      const items = gameList.querySelectorAll('li');
      items.forEach((item) => item.classList.remove('selected'));
    }
  
    // Event listener for game selection
    gameList.addEventListener('click', (e) => {
      if (e.target && e.target.nodeName === 'LI') {
        const index = e.target.dataset.index;
        selectedGame = displayedGames[index];
        displayGameDetails(selectedGame);
  
        // Highlight selected game
        const items = gameList.querySelectorAll('li');
        items.forEach((item) => item.classList.remove('selected'));
        e.target.classList.add('selected');
      }
    });
  
    // Function to display game details
    function displayGameDetails(game) {
      gameTitle.textContent = game.Title;
      gameDescription.textContent = game.Description || 'No description available.';
      launchButton.disabled = false;
  
      // Handle cover image
      if (game.CoverImage) {
        if (game.CoverImage.startsWith('/')) {
          // Local file path
          const coverPath = window.path.join('file://', __dirname, game.CoverImage);
          gameCover.src = coverPath;
        } else {
          // URL
          gameCover.src = game.CoverImage;
        }
      } else {
        gameCover.src = '';
      }
    }
  
    // Launch button event listener
    launchButton.addEventListener('click', () => {
      if (selectedGame) {
        const corePath = selectedGame.CorePath;
        const romPath = selectedGame.RomPaths[0]; // Use the first ROM path
        window.api.launchGame(corePath, romPath);
      }
    });
  });