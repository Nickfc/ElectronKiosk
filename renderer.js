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

    // Alphabet Navigation elements
    const alphabetNav = document.getElementById('alphabetNav');
    const alphabetList = document.getElementById('alphabetList');

    // Home button
    const homeButton = document.getElementById('homeButton');

    let selectedGame = null;
    let allConsoles = [];
    let gameItemsGrid = []; // 2D array for navigation
    let focusedRowIndex = 0;
    let focusedColumnIndex = 0;
    let currentView = 'frontPage'; // 'frontPage' or 'library'
    let isGameRunning = false; // Flag to control input when a game is running
    let focusedMenuIndex = 0; // For side menu navigation
    let alphabet = []; // For alphabet navigation
    let alphabetFocusedIndex = 0; // Focused index in the alphabet list
    let isAlphabetNavActive = false; // Flag to indicate if the alphabet nav is active

    // Variable to control whether to show games without images
    const showGamesWithoutImages = false;

    // Input method tracking
    let lastInputMethod = 'keyboard'; // 'keyboard' or 'controller'

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
      alphabetNav.classList.add('hidden'); // Hide alphabet nav

      consoles.forEach((console, consoleIndex) => {
        let games;
        let totalGamesCount = 0;
        try {
          games = window.api.getGamesForConsole(console.file);

          // Get the total number of games before any filtering
          totalGamesCount = games.length;

          if (!showGamesWithoutImages) {
            games = games.filter((game) => game.CoverImage);
          }
          // Now games may be fewer after filtering

          // Shuffle and get up to 20 games
          games = shuffleArray(games).slice(0, 20);
        } catch (error) {
          console.error(`Failed to load games for ${console.console}`);
          return;
        }

        // Even if we have no games with images, we might still want to show 'View All' cards
        if (totalGamesCount === 0) {
          return; // Skip consoles with no games at all
        }

        // Get a random game cover image
        let randomCoverImage = null;
        if (games.length > 0) {
          const randomGame = games[Math.floor(Math.random() * games.length)];
          if (randomGame && randomGame.CoverImage) {
            randomCoverImage = randomGame.CoverImage;
          }
        }

        // If we don't have a randomCoverImage due to filtering, get one from unfiltered games
        if (!randomCoverImage) {
          try {
            const allGamesWithImages = window.api.getGamesForConsole(console.file).filter((game) => game.CoverImage);
            if (allGamesWithImages.length > 0) {
              const randomGame = allGamesWithImages[Math.floor(Math.random() * allGamesWithImages.length)];
              randomCoverImage = randomGame.CoverImage;
            }
          } catch (error) {
            console.error(`Failed to retrieve cover image for ${console.console}`);
          }
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

        // Create first special card
        const firstCard = createViewAllCard(console, randomCoverImage, totalGamesCount);
        firstCard.dataset.rowIndex = consoleIndex;
        firstCard.dataset.columnIndex = 0;
        consoleGames.push(firstCard);
        gameCarousel.appendChild(firstCard);

        games.forEach((game, gameIndex) => {
          const gameItem = createGameItem(game);
          gameItem.dataset.rowIndex = consoleIndex;
          gameItem.dataset.columnIndex = gameIndex + 1; // Adjust index due to first card
          consoleGames.push(gameItem);
          gameCarousel.appendChild(gameItem);
        });

        // Create last special card
        const lastCard = createViewAllCard(console, randomCoverImage, totalGamesCount);
        lastCard.dataset.rowIndex = consoleIndex;
        lastCard.dataset.columnIndex = consoleGames.length;
        consoleGames.push(lastCard);
        gameCarousel.appendChild(lastCard);

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

    // Function to create the 'View All' card
    function createViewAllCard(console, coverImage, totalGamesCount) {
      const div = document.createElement('div');
      div.classList.add('game-item', 'view-all-card'); // Added 'view-all-card' class
      div.dataset.consoleFile = console.file; // Custom property

      const img = document.createElement('img');
      if (coverImage) {
        if (coverImage.startsWith('http://') || coverImage.startsWith('https://')) {
          img.src = coverImage;
        } else {
          const coverPath = window.path.join(window.api.appDir, coverImage);
          img.src = 'file://' + coverPath;
        }
      } else {
        img.src = ''; // Placeholder image if needed
      }

      // Apply blur effect to image
      img.classList.add('blurred-image');

      // Title Overlay
      const titleOverlay = document.createElement('div');
      titleOverlay.classList.add('game-title-overlay', 'view-all-overlay'); // Added 'view-all-overlay' class
      titleOverlay.textContent = `View all ${totalGamesCount} games`;

      div.appendChild(img);
      div.appendChild(titleOverlay);

      // Click event to load full console library
      div.addEventListener('click', () => {
        loadFullConsoleLibrary(console);
      });

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

      // Build alphabet list
      buildAlphabetNav(games);

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
        const rowIndex = parseInt(gameItem.dataset.rowIndex);
        const columnIndex = parseInt(gameItem.dataset.columnIndex);

        // Ensure the gameItemsGrid has an array for this row
        if (!gameItemsGrid[rowIndex]) {
          gameItemsGrid[rowIndex] = [];
        }

        gameItemsGrid[rowIndex][columnIndex] = gameItem;
        gamesGrid.appendChild(gameItem);
      });

      mainContent.appendChild(consoleHeader);
      mainContent.appendChild(gamesGrid);

      // Initialize focus on the first game item
      focusedRowIndex = 0;
      focusedColumnIndex = 0;
      isAlphabetNavActive = false;
      if (gameItemsGrid.length > 0 && gameItemsGrid[0].length > 0) {
        focusGameItem(gameItemsGrid[0][0]);
      }
    }

    // Function to build the alphabet navigation bar
    function buildAlphabetNav(games) {
      // Extract unique first letters
      const lettersSet = new Set();
      games.forEach((game) => {
        const firstChar = game.Title[0].toUpperCase();
        const letter = /^[A-Z]$/.test(firstChar) ? firstChar : '#';
        lettersSet.add(letter);
      });

      alphabet = Array.from(lettersSet).sort();
      if (lettersSet.has('#')) {
        alphabet = alphabet.filter((letter) => letter !== '#').concat('#');
      }

      // Populate alphabet list
      alphabetList.innerHTML = '';
      alphabet.forEach((letter, index) => {
        const li = document.createElement('li');
        li.textContent = letter;
        li.dataset.index = index;
        li.addEventListener('click', () => {
          jumpToLetter(letter);
        });
        li.addEventListener('mouseenter', () => {
          focusAlphabetItem(index);
          isAlphabetNavActive = true;
        });
        alphabetList.appendChild(li);
      });

      // Show alphabet nav
      alphabetNav.classList.remove('hidden');
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

    // Function to focus on an alphabet item
    function focusAlphabetItem(index) {
      const items = alphabetList.children;
      if (index < 0) index = 0;
      if (index >= items.length) index = items.length - 1;
      alphabetFocusedIndex = index;

      // Remove focus class from previous item
      const focusedElements = document.querySelectorAll('#alphabetList li.focused');
      focusedElements.forEach((el) => el.classList.remove('focused'));

      const item = items[alphabetFocusedIndex];
      if (item) {
        item.classList.add('focused');
      }
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

    // Function to jump to a specific letter
    function jumpToLetter(letter) {
      for (let r = 0; r < gameItemsGrid.length; r++) {
        for (let c = 0; c < gameItemsGrid[r].length; c++) {
          const item = gameItemsGrid[r][c];
          const gameTitle = item.gameData.game.Title;
          const firstChar = gameTitle[0].toUpperCase();
          const itemLetter = /^[A-Z]$/.test(firstChar) ? firstChar : '#';
          if (itemLetter === letter) {
            focusedRowIndex = r;
            focusedColumnIndex = c;
            isAlphabetNavActive = false;
            focusGameItem(item);
            return;
          }
        }
      }
    }

    // Event listener for keydown events
    let keyDebounce = false;
    document.addEventListener('keydown', (event) => {
      event.preventDefault(); // Prevent default browser behavior
      if (isGameRunning) return; // Prevent input when game is running
      if (keyDebounce) return;
      keyDebounce = true;
      setTimeout(() => {
        keyDebounce = false;
      }, 100); // Adjust debounce time as needed

      lastInputMethod = 'keyboard'; // Update the input method

      if (gameModal.classList.contains('hidden') && !sideMenu.classList.contains('open')) {
        if (currentView === 'library') {
          if (isAlphabetNavActive) {
            // Alphabet navigation
            handleKeyboardAlphabetNavigation(event);
          } else {
            // Game items navigation
            handleKeyboardGameItemNavigation(event);
          }
        } else {
          // Front page navigation or other views
          handleKeyboardFrontPageNavigation(event);
        }
      } else if (!gameModal.classList.contains('hidden')) {
        // Modal is open
        handleKeyboardModalNavigation(event);
      } else if (sideMenu.classList.contains('open')) {
        // Side menu is open
        handleKeyboardSideMenuNavigation(event);
      }
    });

    // Function to handle keyboard navigation in the alphabet nav
    function handleKeyboardAlphabetNavigation(event) {
      switch (event.key) {
        case 'ArrowUp':
          focusAlphabetItem(alphabetFocusedIndex - 1);
          break;
        case 'ArrowDown':
          focusAlphabetItem(alphabetFocusedIndex + 1);
          break;
        case 'Enter':
          const selectedLetter = alphabet[alphabetFocusedIndex];
          jumpToLetter(selectedLetter);
          break;
        case 'ArrowLeft':
          isAlphabetNavActive = false;
          focusGameItem(getNextItem(focusedRowIndex, focusedColumnIndex));
          break;
        case 'Escape':
        case 'Backspace':
          isAlphabetNavActive = false;
          focusGameItem(getNextItem(focusedRowIndex, focusedColumnIndex));
          break;
        default:
          break;
      }
    }

    // Function to handle keyboard navigation in game items
    function handleKeyboardGameItemNavigation(event) {
      let nextItem = null;
      switch (event.key) {
        case 'ArrowLeft':
          focusedColumnIndex = Math.max(focusedColumnIndex - 1, 0);
          nextItem = getNextValidItem(focusedRowIndex, focusedColumnIndex, 'left');
          break;
        case 'ArrowRight':
          focusedColumnIndex += 1;
          nextItem = getNextValidItem(focusedRowIndex, focusedColumnIndex, 'right');
          if (!nextItem) {
            // Move to alphabet nav
            isAlphabetNavActive = true;
            focusAlphabetItem(alphabetFocusedIndex);
            return;
          }
          break;
        case 'ArrowUp':
          focusedRowIndex = Math.max(focusedRowIndex - 1, 0);
          nextItem = getNextValidItem(focusedRowIndex, focusedColumnIndex, 'up');
          break;
        case 'ArrowDown':
          focusedRowIndex += 1;
          nextItem = getNextValidItem(focusedRowIndex, focusedColumnIndex, 'down');
          if (!nextItem) {
            // Stay on the current item if no valid next item
            focusedRowIndex -= 1;
            return;
          }
          break;
        case 'Enter':
          const focusedItem = getNextItem(focusedRowIndex, focusedColumnIndex);
          if (focusedItem) {
            focusedItem.click();
          }
          break;
        case 'Backspace':
        case 'Escape':
          // Go back to front page
          populateFrontPage(allConsoles);
          break;
        default:
          break;
      }

      if (nextItem) {
        focusGameItem(nextItem);
      }
    }

    // Function to get the next valid item with edge case handling
    function getNextValidItem(rowIndex, columnIndex, direction) {
      // Validate row index
      if (rowIndex < 0) {
        rowIndex = 0;
      } else if (rowIndex >= gameItemsGrid.length) {
        rowIndex = gameItemsGrid.length - 1;
      }

      // Validate column index
      if (columnIndex < 0) {
        columnIndex = 0;
      }

      let nextItem = getNextItem(rowIndex, columnIndex);

      // Adjust column index if no item exists at the current position
      if (!nextItem) {
        const rowLength = gameItemsGrid[rowIndex]?.length || 0;
        if (rowLength > 0) {
          if (columnIndex >= rowLength) {
            columnIndex = rowLength - 1;
          } else if (columnIndex < 0) {
            columnIndex = 0;
          }
          nextItem = getNextItem(rowIndex, columnIndex);
        } else {
          // Row is empty, try moving in the same direction
          switch (direction) {
            case 'up':
              if (rowIndex > 0) {
                return getNextValidItem(rowIndex - 1, focusedColumnIndex, 'up');
              }
              break;
            case 'down':
              if (rowIndex < gameItemsGrid.length - 1) {
                return getNextValidItem(rowIndex + 1, focusedColumnIndex, 'down');
              }
              break;
            default:
              return null;
          }
        }
      }

      // Update focused indices
      focusedRowIndex = rowIndex;
      focusedColumnIndex = columnIndex;

      return nextItem;
    }

    // Function to handle keyboard navigation on the front page
    function handleKeyboardFrontPageNavigation(event) {
      let nextItem = null;
      switch (event.key) {
        case 'ArrowLeft':
          focusedColumnIndex = Math.max(focusedColumnIndex - 1, 0);
          nextItem = getNextValidItem(focusedRowIndex, focusedColumnIndex, 'left');
          break;
        case 'ArrowRight':
          focusedColumnIndex += 1;
          nextItem = getNextValidItem(focusedRowIndex, focusedColumnIndex, 'right');
          if (!nextItem) {
            // Stay on the current item
            focusedColumnIndex -= 1;
            return;
          }
          break;
        case 'ArrowUp':
          focusedRowIndex = Math.max(focusedRowIndex - 1, 0);
          nextItem = getNextValidItem(focusedRowIndex, focusedColumnIndex, 'up');
          break;
        case 'ArrowDown':
          focusedRowIndex += 1;
          nextItem = getNextValidItem(focusedRowIndex, focusedColumnIndex, 'down');
          if (!nextItem) {
            // Stay on the current item
            focusedRowIndex -= 1;
            return;
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
    }

    // Function to handle keyboard navigation in the modal
    function handleKeyboardModalNavigation(event) {
      switch (event.key) {
        case 'Escape':
        case 'Backspace':
          closeGameModal();
          break;
        default:
          break;
      }
    }

    // Function to handle keyboard navigation in the side menu
    function handleKeyboardSideMenuNavigation(event) {
      switch (event.key) {
        case 'ArrowUp':
          focusedMenuIndex = Math.max(focusedMenuIndex - 1, 0);
          focusMenuItem(consoleList.children[focusedMenuIndex]);
          break;
        case 'ArrowDown':
          focusedMenuIndex = Math.min(focusedMenuIndex + 1, consoleList.children.length - 1);
          focusMenuItem(consoleList.children[focusedMenuIndex]);
          break;
        case 'Enter':
          // Trigger click on focused menu item
          const focusedItem = consoleList.children[focusedMenuIndex];
          if (focusedItem) {
            focusedItem.click();
          }
          break;
        case 'Escape':
        case 'Backspace':
          closeSideMenu();
          break;
        default:
          break;
      }
    }
    // Gamepad support
    let gamepadIndex = null;
    let gamepadDebounce = false;
    function gamepadLoop() {
      if (isGameRunning) {
        requestAnimationFrame(gamepadLoop);
        return; // Prevent input when game is running
      }

      const gamepads = navigator.getGamepads();
      const gamepad = gamepads[gamepadIndex] || gamepads[0];

      if (gamepad) {
        // D-pad navigation or left stick
        const up = gamepad.buttons[12]?.pressed || gamepad.axes[1] < -0.5;
        const down = gamepad.buttons[13]?.pressed || gamepad.axes[1] > 0.5;
        const left = gamepad.buttons[14]?.pressed || gamepad.axes[0] < -0.5;
        const right = gamepad.buttons[15]?.pressed || gamepad.axes[0] > 0.5;
        const select = gamepad.buttons[0]?.pressed; // 'A' button
        const back = gamepad.buttons[1]?.pressed; // 'B' button
        const startButton = gamepad.buttons[9]?.pressed; // 'Start' button
        const selectButton = gamepad.buttons[8]?.pressed; // 'Select' button

        if (!gamepadDebounce) {
          lastInputMethod = 'controller'; // Update the input method

          if (startButton || selectButton) {
            if (sideMenu.classList.contains('open')) {
              closeSideMenu();
            } else {
              openSideMenu();
            }
            gamepadDebounce = true;
            setTimeout(() => {
              gamepadDebounce = false;
            }, 200); // Debounce time for gamepad
          } else if (sideMenu.classList.contains('open')) {
            // Side menu is open
            if (up) {
              focusedMenuIndex = Math.max(focusedMenuIndex - 1, 0);
              focusMenuItem(consoleList.children[focusedMenuIndex]);
              gamepadDebounce = true;
              setTimeout(() => {
                gamepadDebounce = false;
              }, 200);
            } else if (down) {
              focusedMenuIndex = Math.min(focusedMenuIndex + 1, consoleList.children.length - 1);
              focusMenuItem(consoleList.children[focusedMenuIndex]);
              gamepadDebounce = true;
              setTimeout(() => {
                gamepadDebounce = false;
              }, 200);
            } else if (select) {
              // Trigger click on focused menu item
              const focusedItem = consoleList.children[focusedMenuIndex];
              if (focusedItem) {
                focusedItem.click();
              }
              gamepadDebounce = true;
              setTimeout(() => {
                gamepadDebounce = false;
              }, 200);
            } else if (back) {
              // Close side menu
              closeSideMenu();
              gamepadDebounce = true;
              setTimeout(() => {
                gamepadDebounce = false;
              }, 200);
            }
          } else if (gameModal.classList.contains('hidden')) {
            if (currentView === 'library') {
              if (isAlphabetNavActive) {
                // Alphabet navigation
                if (up) {
                  focusAlphabetItem(alphabetFocusedIndex - 1);
                } else if (down) {
                  focusAlphabetItem(alphabetFocusedIndex + 1);
                } else if (select) {
                  const selectedLetter = alphabet[alphabetFocusedIndex];
                  jumpToLetter(selectedLetter);
                } else if (left) {
                  isAlphabetNavActive = false;
                  focusGameItem(getNextItem(focusedRowIndex, focusedColumnIndex));
                } else if (back) {
                  isAlphabetNavActive = false;
                  focusGameItem(getNextItem(focusedRowIndex, focusedColumnIndex));
                }
                gamepadDebounce = true;
                setTimeout(() => {
                  gamepadDebounce = false;
                }, 200);
              } else {
                // Game items navigation
                let nextItem = null;
                if (up) {
                  focusedRowIndex = Math.max(focusedRowIndex - 1, 0);
                  nextItem = getNextValidItem(focusedRowIndex, focusedColumnIndex, 'up');
                } else if (down) {
                  focusedRowIndex += 1;
                  nextItem = getNextValidItem(focusedRowIndex, focusedColumnIndex, 'down');
                  if (!nextItem) {
                    focusedRowIndex -= 1;
                  }
                } else if (left) {
                  focusedColumnIndex = Math.max(focusedColumnIndex - 1, 0);
                  nextItem = getNextValidItem(focusedRowIndex, focusedColumnIndex, 'left');
                } else if (right) {
                  focusedColumnIndex += 1;
                  nextItem = getNextValidItem(focusedRowIndex, focusedColumnIndex, 'right');
                  if (!nextItem) {
                    // Move to alphabet nav
                    isAlphabetNavActive = true;
                    focusAlphabetItem(alphabetFocusedIndex);
                    gamepadDebounce = true;
                    setTimeout(() => {
                      gamepadDebounce = false;
                    }, 200);
                    return;
                  }
                } else if (select) {
                  const focusedItem = getNextItem(focusedRowIndex, focusedColumnIndex);
                  if (focusedItem) {
                    focusedItem.click();
                  }
                  gamepadDebounce = true;
                  setTimeout(() => {
                    gamepadDebounce = false;
                  }, 200);
                } else if (back) {
                  // Go back to front page
                  populateFrontPage(allConsoles);
                  gamepadDebounce = true;
                  setTimeout(() => {
                    gamepadDebounce = false;
                  }, 200);
                }

                if (nextItem) {
                  focusGameItem(nextItem);
                  gamepadDebounce = true;
                  setTimeout(() => {
                    gamepadDebounce = false;
                  }, 200);
                }
              }
            } else {
              // Front page navigation
              let nextItem = null;
              if (up) {
                focusedRowIndex = Math.max(focusedRowIndex - 1, 0);
                nextItem = getNextValidItem(focusedRowIndex, focusedColumnIndex, 'up');
              } else if (down) {
                focusedRowIndex += 1;
                nextItem = getNextValidItem(focusedRowIndex, focusedColumnIndex, 'down');
                if (!nextItem) {
                  focusedRowIndex -= 1;
                }
              } else if (left) {
                focusedColumnIndex = Math.max(focusedColumnIndex - 1, 0);
                nextItem = getNextValidItem(focusedRowIndex, focusedColumnIndex, 'left');
              } else if (right) {
                focusedColumnIndex += 1;
                nextItem = getNextValidItem(focusedRowIndex, focusedColumnIndex, 'right');
                if (!nextItem) {
                  focusedColumnIndex -= 1;
                }
              } else if (select) {
                const focusedItem = getNextItem(focusedRowIndex, focusedColumnIndex);
                if (focusedItem) {
                  focusedItem.click();
                }
                gamepadDebounce = true;
                setTimeout(() => {
                  gamepadDebounce = false;
                }, 200);
              }

              if (nextItem) {
                focusGameItem(nextItem);
                gamepadDebounce = true;
                setTimeout(() => {
                  gamepadDebounce = false;
                }, 200);
              }
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

    // Function to focus on a menu item
    function focusMenuItem(item) {
      if (!item) return;

      // Remove focus class from previous item
      const focusedElements = document.querySelectorAll('#consoleList li.focused');
      focusedElements.forEach((el) => el.classList.remove('focused'));

      item.classList.add('focused');

      // Scroll into view if needed
      item.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }

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
          isGameRunning = true; // Set flag when game starts
          closeGameModal();
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
      // Focus first menu item
      focusedMenuIndex = 0;
      if (consoleList.children.length > 0) {
        focusMenuItem(consoleList.children[focusedMenuIndex]);
      }
    }

    function closeSideMenu() {
      sideMenu.classList.remove('open');
      menuOverlay.classList.add('hidden');
      // Remove focus from menu items
      const focusedElements = document.querySelectorAll('#consoleList li.focused');
      focusedElements.forEach((el) => el.classList.remove('focused'));
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

    // Listen for 'game-ended' event
    window.addEventListener('game-ended', () => {
      isGameRunning = false; // Reset flag when game ends
    });

    // Detect input method changes
    document.addEventListener('mousemove', () => {
      lastInputMethod = 'mouse';
    });

    document.addEventListener('mousedown', () => {
      lastInputMethod = 'mouse';
    });

    document.addEventListener('keypress', () => {
      if (lastInputMethod !== 'keyboard') {
        lastInputMethod = 'keyboard';
      }
    });

    // Ensure focus is visible only for keyboard navigation
    function updateFocusStyles() {
      const style = document.createElement('style');
      style.innerHTML = `
        .game-item:focus {
          outline: none;
        }
        ${lastInputMethod === 'keyboard' ? `
        .game-item.focused {
          border: 3px solid #e50914;
        }` : `
        .game-item.focused {
          border: none;
        }`}
      `;
      document.head.appendChild(style);
    }

    setInterval(updateFocusStyles, 500); // Update focus styles periodically
}); //