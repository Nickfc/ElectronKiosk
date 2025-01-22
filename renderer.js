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
  
    let selectedGame = null;
    let allConsoles = [];
    let allGameItems = [];
    let focusedGameItemIndex = 0;
  
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
      allGameItems = [];
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
  
        games.forEach((game, gameIndex) => {
          const gameItem = createGameItem(game, gameIndex);
          gameCarousel.appendChild(gameItem);
          allGameItems.push(gameItem); // Collect all game items
        });
  
        // Append to console row
        consoleRow.appendChild(consoleHeader);
        consoleRow.appendChild(gameCarousel);
  
        // Append console row to main content
        mainContent.appendChild(consoleRow);
      });
  
      // Initialize focus on the first game item
      if (allGameItems.length > 0) {
        focusGameItem(0);
      }
    }
  
    // Function to create a game item element
    function createGameItem(game, index) {
      const div = document.createElement('div');
      div.classList.add('game-item');
      div.dataset.gameTitle = game.Title;
      div.dataset.consoleFile = game.ConsoleFile; // Custom property to keep track
      div.dataset.index = index;
  
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
  
      div.appendChild(img);
      div.addEventListener('click', () => {
        selectedGame = game;
        openGameModal(selectedGame);
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
      allGameItems = [];
  
      const consoleHeader = document.createElement('h2');
      consoleHeader.textContent = console.console;
  
      const gamesGrid = document.createElement('div');
      gamesGrid.classList.add('games-grid');
  
      games.forEach((game, index) => {
        const gameItem = createGameItem(game, index);
        gamesGrid.appendChild(gameItem);
        allGameItems.push(gameItem); // Collect all game items
      });
  
      mainContent.appendChild(consoleHeader);
      mainContent.appendChild(gamesGrid);
  
      // Initialize focus on the first game item
      if (allGameItems.length > 0) {
        focusGameItem(0);
      }
    }
  
    // Function to focus on a game item
    function focusGameItem(index) {
      if (allGameItems.length === 0) return;
  
      // Remove focus class from all items
      allGameItems.forEach((item) => {
        item.classList.remove('focused');
      });
  
      // Keep index within bounds
      if (index < 0) {
        index = allGameItems.length - 1;
      } else if (index >= allGameItems.length) {
        index = 0;
      }
  
      focusedGameItemIndex = index;
      const currentItem = allGameItems[focusedGameItemIndex];
      currentItem.classList.add('focused');
  
      // Scroll into view if needed
      currentItem.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  
    // Event listener for keydown events
    document.addEventListener('keydown', (event) => {
      if (gameModal.classList.contains('hidden')) {
        switch (event.key) {
          case 'ArrowLeft':
            focusGameItem(focusedGameItemIndex - 1);
            break;
          case 'ArrowRight':
            focusGameItem(focusedGameItemIndex + 1);
            break;
          case 'ArrowUp':
            focusGameItem(focusedGameItemIndex - 5); // Adjust based on columns
            break;
          case 'ArrowDown':
            focusGameItem(focusedGameItemIndex + 5); // Adjust based on columns
            break;
          case 'Enter':
            // Simulate click on focused item
            const currentItem = allGameItems[focusedGameItemIndex];
            currentItem.click();
            break;
          default:
            break;
        }
      } else {
        // Modal is open
        switch (event.key) {
          case 'ArrowLeft':
          case 'ArrowRight':
            // Optional: Add navigation between modal buttons if needed
            break;
          case 'Enter':
            modalLaunchButton.click();
            break;
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
  
        // Handle navigation with debounce
        if (!gamepad.lastButtonStates) {
          gamepad.lastButtonStates = [];
        }
  
        function buttonPressed(index) {
          const pressed = gamepad.buttons[index].pressed;
          const lastPressed = gamepad.lastButtonStates[index] || false;
          gamepad.lastButtonStates[index] = pressed;
          return pressed && !lastPressed;
        }
  
        if (buttonPressed(12) || up) {
          focusGameItem(focusedGameItemIndex - 5);
        } else if (buttonPressed(13) || down) {
          focusGameItem(focusedGameItemIndex + 5);
        } else if (buttonPressed(14) || left) {
          focusGameItem(focusedGameItemIndex - 1);
        } else if (buttonPressed(15) || right) {
          focusGameItem(focusedGameItemIndex + 1);
        } else if (buttonPressed(0)) {
          // 'A' button
          if (gameModal.classList.contains('hidden')) {
            const currentItem = allGameItems[focusedGameItemIndex];
            currentItem.click();
          } else {
            modalLaunchButton.click();
          }
        } else if (buttonPressed(1)) {
          // 'B' button
          if (!gameModal.classList.contains('hidden')) {
            closeGameModal();
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