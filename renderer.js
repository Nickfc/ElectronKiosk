// renderer.js
window.addEventListener('DOMContentLoaded', () => {
    const mainContent = document.getElementById('mainContent');
    const errorDisplay = document.getElementById('errorDisplay');

    // Side menu elements
    const sideMenu = document.getElementById('sideMenu');
    const consoleList = document.getElementById('consoleList');
    const openMenuButton = document.getElementById('openMenuButton');
    const closeMenuButton = document.getElementById('closeMenuButton');
    const menuOverlay = document.getElementById('menuOverlay');

    // Modal elements
    const gameModal = document.getElementById('gameModal');
    const modalBackground = document.getElementById('modalBackground');
    const modalGameTitle = document.getElementById('modalGameTitle');
    const modalGameCover = document.getElementById('modalGameCover');
    const modalGameDescription = document.getElementById('modalGameDescription');
    const modalLaunchButton = document.getElementById('modalLaunchButton');
    const modalCloseButton = document.getElementById('modalCloseButton');

    // Home button
    const homeButton = document.getElementById('homeButton');

    let selectedGame = null;
    let allConsoles = [];
    let gameItemsGrid = []; // 2D array for navigation
    let focusedRowIndex = 0;
    let focusedColumnIndex = 0;
    let currentView = 'frontPage'; // 'frontPage' or 'library'

    // Variable to control whether to show games without images
    const showGamesWithoutImages = false;

    // Fetch consoles and populate front page and side menu
    try {
      allConsoles = window.api.getConsoles();
      populateSideMenu(allConsoles);
      populateFrontPage(allConsoles);
    } catch (error) {
      displayError('Failed to load consoles.');
    }

    // Function to populate the side menu with consoles
    function populateSideMenu(consoles) {
      consoles.forEach((console, index) => {
        const li = document.createElement('li');
        li.textContent = console.console;
        li.dataset.index = index;
        li.addEventListener('click', () => {
          loadFullConsoleLibrary(console);
          closeSideMenu();
        });
        consoleList.appendChild(li);
      });
    }

    // Function to populate the front page with console rows
    function populateFrontPage(consoles) {
      mainContent.innerHTML = '';
      gameItemsGrid = [];
      currentView = 'frontPage';

      consoles.forEach((console, consoleIndex) => {
        let games;
        try {
          games = window.api.getGamesForConsole(console.file);
          if (!showGamesWithoutImages) {
            games = games.filter((game) => game.CoverImage);
          }
          // Shuffle and get up to 20 games
          games = shuffleArray(games).slice(0, 20);
        } catch (error) {
          console.error(`Failed to load games for ${console.console}`);
          return;
        }

        if (games.length === 0) {
          return;
        }

        // Console Row
        const consoleRow = document.createElement('div');
        consoleRow.classList.add('console-row');

        // Console Row Header
        const consoleHeader = document.createElement('div');
        consoleHeader.classList.add('console-header');
        consoleHeader.textContent = console.console;

        // View All Button
        const viewAllButton = document.createElement('button');
        viewAllButton.classList.add('view-all-button');
        viewAllButton.textContent = 'View All';
        viewAllButton.addEventListener('click', () => {
          loadFullConsoleLibrary(console);
        });

        // Append view all button to header
        consoleHeader.appendChild(viewAllButton);

        // Game Carousel
        const gameCarousel = document.createElement('div');
        gameCarousel.classList.add('game-carousel');

        const consoleGames = []; // Array to store game items in this console row

        games.forEach((game, gameIndex) => {
          const gameItem = createGameItem(game);
          gameItem.dataset.rowIndex = consoleIndex;
          gameItem.dataset.columnIndex = gameIndex;
          consoleGames.push(gameItem);
          gameCarousel.appendChild(gameItem);
        });

        // Append to console row
        consoleRow.appendChild(consoleHeader);
        consoleRow.appendChild(gameCarousel);

        // Append console row to main content
        mainContent.appendChild(consoleRow);

        // Add console games to grid
        gameItemsGrid.push(consoleGames);
      });

      // Initialize focus on the first game item
      focusedRowIndex = 0;
      focusedColumnIndex = 0;
      if (gameItemsGrid.length > 0 && gameItemsGrid[0].length > 0) {
        focusGameItem(gameItemsGrid[0][0]);
      }
    }

    // Function to create a game item element
    function createGameItem(game) {
      const div = document.createElement('div');
      div.classList.add('game-item');
      div.dataset.gameTitle = game.Title;
      div.dataset.consoleFile = game.ConsoleFile; // Custom property to keep track

      const img = document.createElement('img');
      if (game.CoverImage) {
        if (game.CoverImage.startsWith('http://') || game.CoverImage.startsWith('https://')) {
          img.src = game.CoverImage;
        } else {
          const coverPath = window.path.join(window.api.appDir, game.CoverImage);
          img.src = 'file://' + coverPath;
        }
      } else {
        img.src = ''; // Placeholder image if needed
      }

      // Game Title Overlay
      const titleOverlay = document.createElement('div');
      titleOverlay.classList.add('game-title-overlay');
      titleOverlay.textContent = game.Title;

      div.appendChild(img);
      div.appendChild(titleOverlay);
      div.addEventListener('click', () => {
        selectedGame = game;
        openGameModal(selectedGame);
      });

      // Store references for navigation
      div.gameData = { game };

      return div;
    }

    // Function to load full console library
    function loadFullConsoleLibrary(console) {
      let games;
      try {
        games = window.api.getGamesForConsole(console.file);
        if (!showGamesWithoutImages) {
          games = games.filter((game) => game.CoverImage);
        }
      } catch (error) {
        displayError('Failed to load games for the selected console.');
        return;
      }

      mainContent.innerHTML = '';
      gameItemsGrid = [];
      currentView = 'library';

      const consoleHeader = document.createElement('h2');
      consoleHeader.textContent = console.console;

      const gamesGrid = document.createElement('div');
      gamesGrid.classList.add('games-grid');

      const itemsPerRow = Math.floor(mainContent.clientWidth / 220); // Approximate width per game item
      let currentRow = [];
      games.forEach((game, index) => {
        const gameItem = createGameItem(game);
        gameItem.dataset.rowIndex = Math.floor(index / itemsPerRow);
        gameItem.dataset.columnIndex = index % itemsPerRow;
        currentRow.push(gameItem);
        gamesGrid.appendChild(gameItem);

        if ((index + 1) % itemsPerRow === 0) {
          gameItemsGrid.push(currentRow);
          currentRow = [];
        }
      });
      if (currentRow.length > 0) {
        gameItemsGrid.push(currentRow);
      }

      mainContent.appendChild(consoleHeader);
      mainContent.appendChild(gamesGrid);

      // Initialize focus on the first game item
      focusedRowIndex = 0;
      focusedColumnIndex = 0;
      if (gameItemsGrid.length > 0 && gameItemsGrid[0].length > 0) {
        focusGameItem(gameItemsGrid[0][0]);
      }
    }

    // Function to focus on a game item
    function focusGameItem(item) {
      if (!item) return;

      // Remove focus class from previous item
      const focusedElements = document.querySelectorAll('.game-item.focused');
      focusedElements.forEach((el) => el.classList.remove('focused'));

      item.classList.add('focused');

      // Scroll into view if needed
      item.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }

    // Function to get the next item based on row and column indices
    function getNextItem(rowIndex, columnIndex) {
      if (
        rowIndex >= 0 &&
        rowIndex < gameItemsGrid.length &&
        columnIndex >= 0 &&
        columnIndex < gameItemsGrid[rowIndex].length
      ) {
        return gameItemsGrid[rowIndex][columnIndex];
      }
      return null;
    }

    // Event listener for keydown events
    let keyDebounce = false;
    document.addEventListener('keydown', (event) => {
      if (keyDebounce) return;
      keyDebounce = true;
      setTimeout(() => {
        keyDebounce = false;
      }, 100); // Adjust debounce time as needed

      if (gameModal.classList.contains('hidden')) {
        let nextItem = null;
        switch (event.key) {
          case 'ArrowLeft':
            focusedColumnIndex = Math.max(focusedColumnIndex - 1, 0);
            nextItem = getNextItem(focusedRowIndex, focusedColumnIndex);
            break;
          case 'ArrowRight':
            focusedColumnIndex += 1;
            nextItem = getNextItem(focusedRowIndex, focusedColumnIndex);
            // Adjust if no item in that column
            if (!nextItem) {
              focusedColumnIndex -= 1;
              nextItem = getNextItem(focusedRowIndex, focusedColumnIndex);
            }
            break;
          case 'ArrowUp':
            focusedRowIndex = Math.max(focusedRowIndex - 1, 0);
            // Adjust column index if out of bounds
            nextItem = getNextItem(focusedRowIndex, focusedColumnIndex);
            if (!nextItem) {
              focusedColumnIndex = gameItemsGrid[focusedRowIndex].length - 1;
              nextItem = getNextItem(focusedRowIndex, focusedColumnIndex);
            }
            break;
          case 'ArrowDown':
            focusedRowIndex += 1;
            // Adjust if no more rows
            if (focusedRowIndex >= gameItemsGrid.length) {
              focusedRowIndex -= 1;
            }
            // Adjust column index if out of bounds
            nextItem = getNextItem(focusedRowIndex, focusedColumnIndex);
            if (!nextItem) {
              focusedColumnIndex = gameItemsGrid[focusedRowIndex].length - 1;
              nextItem = getNextItem(focusedRowIndex, focusedColumnIndex);
            }
            break;
          case 'Enter':
            const focusedItem = getNextItem(focusedRowIndex, focusedColumnIndex);
            if (focusedItem) {
              focusedItem.click();
            }
            break;
          default:
            break;
        }

        if (nextItem) {
          focusGameItem(nextItem);
        }
      } else {
        // Modal is open
        switch (event.key) {
          case 'Escape':
            closeGameModal();
            break;
          default:
            break;
        }
      }
    });

    // Gamepad support
    let gamepadIndex = null;
    let gamepadDebounce = false;
    function gamepadLoop() {
      const gamepads = navigator.getGamepads();
      const gamepad = gamepads[gamepadIndex] || gamepads[0];

      if (gamepad) {
        // D-pad navigation or left stick
        const up = gamepad.buttons[12].pressed || gamepad.axes[1] < -0.5;
        const down = gamepad.buttons[13].pressed || gamepad.axes[1] > 0.5;
        const left = gamepad.buttons[14].pressed || gamepad.axes[0] < -0.5;
        const right = gamepad.buttons[15].pressed || gamepad.axes[0] > 0.5;
        const select = gamepad.buttons[0].pressed; // 'A' button
        const back = gamepad.buttons[1].pressed; // 'B' button

        if (!gamepadDebounce) {
          if (gameModal.classList.contains('hidden')) {
            let nextItem = null;
            if (up) {
              focusedRowIndex = Math.max(focusedRowIndex - 1, 0);
              nextItem = getNextItem(focusedRowIndex, focusedColumnIndex);
              if (!nextItem) {
                focusedColumnIndex = gameItemsGrid[focusedRowIndex].length - 1;
                nextItem = getNextItem(focusedRowIndex, focusedColumnIndex);
              }
            } else if (down) {
              focusedRowIndex += 1;
              if (focusedRowIndex >= gameItemsGrid.length) {
                focusedRowIndex -= 1;
              }
              nextItem = getNextItem(focusedRowIndex, focusedColumnIndex);
              if (!nextItem) {
                focusedColumnIndex = gameItemsGrid[focusedRowIndex].length - 1;
                nextItem = getNextItem(focusedRowIndex, focusedColumnIndex);
              }
            } else if (left) {
              focusedColumnIndex = Math.max(focusedColumnIndex - 1, 0);
              nextItem = getNextItem(focusedRowIndex, focusedColumnIndex);
            } else if (right) {
              focusedColumnIndex += 1;
              nextItem = getNextItem(focusedRowIndex, focusedColumnIndex);
              if (!nextItem) {
                focusedColumnIndex -= 1;
                nextItem = getNextItem(focusedRowIndex, focusedColumnIndex);
              }
            } else if (select) {
              const focusedItem = getNextItem(focusedRowIndex, focusedColumnIndex);
              if (focusedItem) {
                focusedItem.click();
              }
            } else if (back) {
              // Do nothing for now
            }

            if (nextItem) {
              focusGameItem(nextItem);
              gamepadDebounce = true;
              setTimeout(() => {
                gamepadDebounce = false;
              }, 200); // Debounce time for gamepad
            }
          } else {
            // Modal is open
            if (back) {
              closeGameModal();
              gamepadDebounce = true;
              setTimeout(() => {
                gamepadDebounce = false;
              }, 200); // Debounce time for gamepad
            } else if (select) {
              modalLaunchButton.click();
              gamepadDebounce = true;
              setTimeout(() => {
                gamepadDebounce = false;
              }, 200); // Debounce time for gamepad
            }
          }
        }
      }

      requestAnimationFrame(gamepadLoop);
    }

    window.addEventListener('gamepadconnected', (e) => {
      gamepadIndex = e.gamepad.index;
      gamepadLoop();
    });

    window.addEventListener('gamepaddisconnected', (e) => {
      if (gamepadIndex === e.gamepad.index) {
        gamepadIndex = null;
      }
    });

    // Function to open game modal and display details
    function openGameModal(game) {
      modalGameTitle.textContent = game.Title;
      modalGameDescription.textContent = game.Description || 'No description available.';

      // Set modal background image
      if (game.CoverImage) {
        let imageUrl;
        if (game.CoverImage.startsWith('http://') || game.CoverImage.startsWith('https://')) {
          imageUrl = game.CoverImage;
        } else {
          const coverPath = window.path.join(window.api.appDir, game.CoverImage);
          imageUrl = 'file://' + coverPath;
        }
        modalBackground.style.backgroundImage = `url(${imageUrl})`;
        modalGameCover.src = imageUrl;
      } else {
        modalBackground.style.backgroundImage = '';
        modalGameCover.src = '';
      }

      gameModal.classList.remove('hidden');
    }

    // Close modal function
    function closeGameModal() {
      gameModal.classList.add('hidden');
      selectedGame = null;
    }

    // Event listeners for modal buttons
    modalCloseButton.addEventListener('click', closeGameModal);

    modalLaunchButton.addEventListener('click', () => {
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

    // Close modal when clicking outside the modal body
    gameModal.addEventListener('click', (e) => {
      if (e.target === gameModal) {
        closeGameModal();
      }
    });

    // Side menu event listeners
    openMenuButton.addEventListener('click', openSideMenu);
    closeMenuButton.addEventListener('click', closeSideMenu);
    menuOverlay.addEventListener('click', closeSideMenu);

    function openSideMenu() {
      sideMenu.classList.add('open');
      menuOverlay.classList.remove('hidden');
    }

    function closeSideMenu() {
      sideMenu.classList.remove('open');
      menuOverlay.classList.add('hidden');
    }

    // Event listener for 'Home' button
    homeButton.addEventListener('click', () => {
      populateFrontPage(allConsoles);
    });

    // Utility function to display error messages
    function displayError(message) {
      errorDisplay.textContent = message;
      errorDisplay.classList.remove('hidden');
      setTimeout(() => {
        errorDisplay.classList.add('hidden');
      }, 5000);
    }

    // Utility function to shuffle an array
    function shuffleArray(array) {
      return array.sort(() => Math.random() - 0.5);
    }
  });