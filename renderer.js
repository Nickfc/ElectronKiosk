// renderer.js
window.addEventListener('DOMContentLoaded', () => {
    const consoleSelect = document.getElementById('consoleSelect');
    const gameList = document.getElementById('gameList');
    const searchInput = document.getElementById('searchInput');
    const genreFilter = document.getElementById('genreFilter');
    const yearFilter = document.getElementById('yearFilter');
    const developerFilter = document.getElementById('developerFilter');
    const errorDisplay = document.getElementById('errorDisplay');

    const gameTitle = document.getElementById('gameTitle');
    const gameCover = document.getElementById('gameCover');
    const gameDescription = document.getElementById('gameDescription');
    const launchButton = document.getElementById('launchButton');

    let allGames = [];
    let displayedGames = [];
    let selectedGame = null;
    let currentSelectedIndex = -1;

    // Populate consoles dropdown
    try {
      const consoles = window.api.getConsoles();
      consoles.forEach((console) => {
        const option = document.createElement('option');
        option.value = console.file;
        option.textContent = `${console.console} (${console.count})`;
        consoleSelect.appendChild(option);
      });
    } catch (error) {
      displayError('Failed to load consoles.');
    }

    // Event listener for console selection
    consoleSelect.addEventListener('change', () => {
      const consoleFile = consoleSelect.value;
      if (consoleFile) {
        try {
          const games = window.api.getGamesForConsole(consoleFile);
          allGames = games;
          populateFilters(games);
          applyFilters();
          resetGameDetails();
        } catch (error) {
          displayError('Failed to load games for the selected console.');
        }
      } else {
        gameList.innerHTML = '';
        allGames = [];
        resetFilters();
        resetGameDetails();
      }
    });

    // Populate filter dropdowns
    function populateFilters(games) {
      const genres = new Set();
      const years = new Set();
      const developers = new Set();

      games.forEach((game) => {
        if (game.Genre) genres.add(game.Genre);
        if (game.ReleaseYear) years.add(game.ReleaseYear);
        if (game.Developer) developers.add(game.Developer);
      });

      populateFilterDropdown(genreFilter, genres, 'All Genres');
      populateFilterDropdown(yearFilter, years, 'All Years');
      populateFilterDropdown(developerFilter, developers, 'All Developers');
    }

    function populateFilterDropdown(filterElement, items, defaultOption) {
      filterElement.innerHTML = `<option value="">${defaultOption}</option>`;
      Array.from(items)
        .sort()
        .forEach((item) => {
          const option = document.createElement('option');
          option.value = item;
          option.textContent = item;
          filterElement.appendChild(option);
        });
    }

    function resetFilters() {
      genreFilter.innerHTML = '<option value="">All Genres</option>';
      yearFilter.innerHTML = '<option value="">All Years</option>';
      developerFilter.innerHTML = '<option value="">All Developers</option>';
    }

    // Apply filters and search query
    function applyFilters() {
      let filteredGames = allGames;

      const query = searchInput.value.toLowerCase();
      if (query) {
        filteredGames = filteredGames.filter((game) =>
          game.Title.toLowerCase().includes(query)
        );
      }

      const selectedGenre = genreFilter.value;
      if (selectedGenre) {
        filteredGames = filteredGames.filter((game) => game.Genre === selectedGenre);
      }

      const selectedYear = yearFilter.value;
      if (selectedYear) {
        filteredGames = filteredGames.filter((game) => game.ReleaseYear === selectedYear);
      }

      const selectedDeveloper = developerFilter.value;
      if (selectedDeveloper) {
        filteredGames = filteredGames.filter((game) => game.Developer === selectedDeveloper);
      }

      displayGameList(filteredGames);
      resetGameDetails();
    }

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

    // Event listeners for filters and search input with debounce
    [searchInput, genreFilter, yearFilter, developerFilter].forEach((element) => {
      element.addEventListener(
        'input',
        debounce(() => {
          applyFilters();
        }, 300)
      );
    });

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
      currentSelectedIndex = -1;
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

    // Event listener for game selection (mouse click)
    gameList.addEventListener('click', (e) => {
      if (e.target && e.target.nodeName === 'LI') {
        selectGame(parseInt(e.target.dataset.index));
      }
    });

    // Keyboard navigation for game list
    gameList.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateGameList(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateGameList(-1);
      } else if (e.key === 'Enter') {
        if (currentSelectedIndex >= 0) {
          selectGame(currentSelectedIndex);
        }
      }
    });

    // Navigate game list with keyboard
    function navigateGameList(direction) {
      if (displayedGames.length === 0) return;
      currentSelectedIndex += direction;
      if (currentSelectedIndex < 0) currentSelectedIndex = displayedGames.length - 1;
      if (currentSelectedIndex >= displayedGames.length) currentSelectedIndex = 0;
      highlightSelectedGame();
    }

    // Highlight selected game in the list
    function highlightSelectedGame() {
      const items = gameList.querySelectorAll('li');
      items.forEach((item) => item.classList.remove('selected'));
      const selectedItem = items[currentSelectedIndex];
      if (selectedItem) {
        selectedItem.classList.add('selected');
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }

    // Select game and display details
    function selectGame(index) {
      selectedGame = displayedGames[index];
      currentSelectedIndex = index;
      displayGameDetails(selectedGame);
      highlightSelectedGame();
    }

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
        try {
          window.api.launchGame(corePath, romPath);
        } catch (error) {
          displayError('Failed to launch the game.');
        }
      }
    });

    // Keyboard shortcut to launch game (Enter key)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && document.activeElement !== searchInput) {
        launchButton.click();
      }
    });

    // Display error messages in the UI
    function displayError(message) {
      errorDisplay.textContent = message;
      errorDisplay.classList.remove('hidden');
      setTimeout(() => {
        errorDisplay.classList.add('hidden');
      }, 5000);
    }
  });