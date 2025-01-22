// renderer.js
window.addEventListener('DOMContentLoaded', () => {
    const consoleSelect = document.getElementById('consoleSelect');
    const gameGrid = document.getElementById('gameGrid');
    const errorDisplay = document.getElementById('errorDisplay');
  
    // Modal elements
    const gameModal = document.getElementById('gameModal');
    const modalBackground = document.getElementById('modalBackground');
    const modalGameTitle = document.getElementById('modalGameTitle');
    const modalGameCover = document.getElementById('modalGameCover');
    const modalGameDescription = document.getElementById('modalGameDescription');
    const modalLaunchButton = document.getElementById('modalLaunchButton');
    const modalCloseButton = document.getElementById('modalCloseButton');
  
    let allGames = [];
    let selectedGame = null;
  
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
          displayGameGrid(games);
        } catch (error) {
          displayError('Failed to load games for the selected console.');
        }
      } else {
        gameGrid.innerHTML = '';
        allGames = [];
      }
    });
  
    // Function to display game grid
    function displayGameGrid(games) {
      gameGrid.innerHTML = '';
  
      games.forEach((game, index) => {
        const div = document.createElement('div');
        div.classList.add('game-item');
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
        gameGrid.appendChild(div);
      });
    }
  
    // Event listener for game item click
    gameGrid.addEventListener('click', (e) => {
      const gameItem = e.target.closest('.game-item');
      if (gameItem) {
        const index = parseInt(gameItem.dataset.index);
        selectedGame = allGames[index];
        openGameModal(selectedGame);
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
  
    // Display error messages in the UI
    function displayError(message) {
      errorDisplay.textContent = message;
      errorDisplay.classList.remove('hidden');
      setTimeout(() => {
        errorDisplay.classList.add('hidden');
      }, 5000);
    }
  });