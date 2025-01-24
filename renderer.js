// renderer.js

window.addEventListener('DOMContentLoaded', async () => {
    // Initialize Notyf once
    const notyf = new Notyf();

    // Utility function to display error messages
    function displayError(message) {
        notyf.error(message);
    }

    const mainContent = document.getElementById('mainContent');
    const errorDisplay = document.getElementById('errorDisplay');
    const loadingSpinner = document.getElementById('loadingSpinner');

    // Side menu elements
    const sideMenu = document.getElementById('sideMenu');
    const consoleList = document.getElementById('consoleList');
    const openMenuButton = document.getElementById('openMenuButton');
    const closeMenuButton = document.getElementById('closeMenuButton');
    const menuOverlay = document.getElementById('menuOverlay');
    const exitAppButton = document.getElementById('exitAppButton');

    // Modal elements
    const gameModal = document.getElementById('gameModal');
    const modalBackground = document.getElementById('modalBackground');
    const modalGameTitle = document.getElementById('modalGameTitle');
    const modalGameCover = document.getElementById('modalGameCover');
    const modalGameDescription = document.getElementById('modalGameDescription');
    const modalLaunchButton = document.getElementById('modalLaunchButton');
    const modalCloseButton = document.getElementById('modalCloseButton');
    const modalPrevButton = document.getElementById('modalPrevButton');
    const modalNextButton = document.getElementById('modalNextButton');

    // Alphabet Navigation elements
    const alphabetNav = document.getElementById('alphabetNav');
    const alphabetList = document.getElementById('alphabetList');

    // Home button
    const homeButton = document.getElementById('homeButton');

    // Background overlay
    const backgroundOverlay = document.getElementById('backgroundOverlay');

    // Search bar
    const searchBar = document.getElementById('searchBar');

    // Settings elements
    const settingsButton = document.getElementById('settingsButton');
    const settingsModal = document.getElementById('settingsModal');
    const settingsCloseButton = document.getElementById('settingsCloseButton');
    const showGamesWithoutImagesCheckbox = document.getElementById('showGamesWithoutImagesCheckbox');
    const fontSelect = document.getElementById('fontSelect');
    const fontSizeSelect = document.getElementById('fontSizeSelect');

    // Application State and Caches
    let selectedGame = null;
    let allConsoles = []; // Cached consoles data
    let consoleGamesCache = {}; // Cache for games per consoleFile
    let allGames = []; // Cached all games in current view
    let filteredGames = []; // Filtered games based on search
    let gameItemsGrid = []; // 2D array for navigation
    let focusedRowIndex = 0;
    let focusedColumnIndex = 0;
    let desiredColumnIndex = 0; // To maintain desired column position
    let currentView = 'frontPage'; // 'frontPage' or 'library'
    let isGameRunning = false; // Flag to control input when a game is running
    let focusedMenuIndex = 0; // For side menu navigation
    let alphabet = []; // For alphabet navigation
    let alphabetFocusedIndex = 0; // Focused index in the alphabet list
    let isAlphabetNavActive = false; // Flag to indicate if the alphabet nav is active

    // Preferences and Settings
    let showGamesWithoutImages = loadPreference('showGamesWithoutImages');
    if (typeof showGamesWithoutImages !== 'boolean') {
        showGamesWithoutImages = false;
        savePreference('showGamesWithoutImages', showGamesWithoutImages);
    }

    // Font preferences
    let selectedFont = loadPreference('selectedFont');
    if (!selectedFont) {
        selectedFont = 'Raleway';
        savePreference('selectedFont', selectedFont);
    }
    let selectedFontSize = loadPreference('selectedFontSize');
    if (!selectedFontSize) {
        selectedFontSize = 'normal';
        savePreference('selectedFontSize', selectedFontSize);
    }

    // Apply font preferences
    applyFontPreferences();

    // Input method tracking
    let lastInputMethod = 'keyboard'; // 'keyboard', 'controller', or 'mouse'

    // Listen for error notifications from preload.js
    window.addEventListener('notify-error', (e) => {
        displayError(e.detail);
    });

    // Fetch consoles and populate front page and side menu
    try {
        showLoadingSpinner();
        allConsoles = await window.api.getConsoles(); // Async call
        console.log('All Consoles:', allConsoles); // Debugging Line

        if (!Array.isArray(allConsoles)) {
            throw new Error('getConsoles() did not return an array.');
        }

        populateSideMenu(allConsoles);
        await populateFrontPage(allConsoles);
    } catch (error) {
        console.error('Error loading consoles:', error); // Enhanced Error Logging
        displayError('Failed to load consoles.');
    } finally {
        hideLoadingSpinner();
    }

    // Function to populate the side menu with consoles
    function populateSideMenu(consoles) {
        if (!consoleList) {
            console.error('consoleList element not found.');
            displayError('Console list element is missing.');
            return;
        }

        consoleList.innerHTML = ''; // Clear existing items
        consoles.forEach((con, index) => { // Changed 'console' to 'con' to avoid shadowing
            const li = document.createElement('li');
            li.textContent = con.console;
            li.dataset.index = index;
            li.setAttribute('tabindex', '0');
            li.addEventListener('click', () => {
                focusedConsoleIndex = index;
                loadFullConsoleLibrary(con);
                closeSideMenu();
            });
            li.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    li.click();
                }
            });
            consoleList.appendChild(li);
        });
    }

    // Function to populate the front page with console rows
    async function populateFrontPage(consoles) {
        if (!mainContent) {
            console.error('mainContent element not found.');
            displayError('Main content element is missing.');
            return;
        }

        mainContent.innerHTML = '';
        gameItemsGrid = [];
        currentView = 'frontPage';
        if (alphabetNav) alphabetNav.classList.add('hidden'); // Hide alphabet nav
        if (searchBar) searchBar.classList.add('hidden'); // Hide search bar

        filteredGames = []; // Reset filteredGames to store displayed games

        for (let consoleIndex = 0; consoleIndex < consoles.length; consoleIndex++) {
            const con = consoles[consoleIndex]; // Changed 'console' to 'con' to avoid shadowing
            let games;
            let totalGamesCount = 0;
            try {
                // Check cache first
                if (consoleGamesCache[con.file]) {
                    games = consoleGamesCache[con.file];
                } else {
                    games = await window.api.getGamesForConsole(con.file); // Async call
                    console.log(`Games for console ${con.console}:`, games); // Debugging Line
                    if (!Array.isArray(games)) {
                        throw new Error(`getGamesForConsole() did not return an array for console ${con.console}.`);
                    }
                    consoleGamesCache[con.file] = games; // Cache the games
                }

                // Get the total number of games before any filtering
                totalGamesCount = games.length;

                if (!showGamesWithoutImages) {
                    games = games.filter((game) => game.CoverImage);
                }
                // Now games may be fewer after filtering
            } catch (error) {
                console.error(`Failed to load games for ${con.console}:`, error);
                displayError(`Failed to load games for ${con.console}.`);
                continue;
            }

            // Even if we have no games with images, we might still want to show 'View All' cards
            if (totalGamesCount === 0) {
                console.warn(`No games found for console ${con.console}.`);
                continue; // Skip consoles with no games at all
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
                    let allGamesForCon;
                    if (consoleGamesCache[con.file + '_all']) {
                        allGamesForCon = consoleGamesCache[con.file + '_all'];
                    } else {
                        allGamesForCon = await window.api.getGamesForConsole(con.file); // Async call
                        consoleGamesCache[con.file + '_all'] = allGamesForCon; // Cache all games
                    }

                    const allGamesWithImages = allGamesForCon.filter((game) => game.CoverImage);
                    if (allGamesWithImages.length > 0) {
                        const randomGame = allGamesWithImages[Math.floor(Math.random() * allGamesWithImages.length)];
                        randomCoverImage = randomGame.CoverImage;
                    }
                } catch (error) {
                    console.error(`Failed to retrieve cover image for ${con.console}:`, error);
                }
            }

            // Console Row
            const consoleRow = document.createElement('div');
            consoleRow.classList.add('console-row');

            // Console Row Header
            const consoleHeader = document.createElement('div');
            consoleHeader.classList.add('console-header');

            const consoleTitle = document.createElement('h2');
            consoleTitle.textContent = con.console;

            // View All Button
            const viewAllButton = document.createElement('button');
            viewAllButton.classList.add('view-all-button');
            viewAllButton.textContent = 'View All';
            viewAllButton.addEventListener('click', () => {
                focusedConsoleIndex = consoleIndex;
                loadFullConsoleLibrary(con);
            });

            // Append title and view all button to header
            consoleHeader.appendChild(consoleTitle);
            consoleHeader.appendChild(viewAllButton);

            // Game Carousel
            const gameCarousel = document.createElement('div');
            gameCarousel.classList.add('game-carousel');

            const consoleGames = []; // Array to store game items in this console row

            // Create first special card
            const firstCard = createViewAllCard(con, randomCoverImage, totalGamesCount);
            firstCard.dataset.rowIndex = consoleIndex;
            firstCard.dataset.columnIndex = 0;
            consoleGames.push(firstCard);
            gameCarousel.appendChild(firstCard);

            for (let gameIndex = 0; gameIndex < games.length; gameIndex++) {
                const game = games[gameIndex];
                const gameItem = createGameItem(game);
                gameItem.dataset.rowIndex = consoleIndex;
                gameItem.dataset.columnIndex = gameIndex + 1; // Adjust index due to first card
                const rowIndex = parseInt(gameItem.dataset.rowIndex);
                const columnIndex = parseInt(gameItem.dataset.columnIndex);

                // Ensure the gameItemsGrid has an array for this row
                if (!gameItemsGrid[rowIndex]) {
                    gameItemsGrid[rowIndex] = [];
                }

                gameItemsGrid[rowIndex][columnIndex] = gameItem;
                consoleGames.push(gameItem);
                gameCarousel.appendChild(gameItem);

                // Add to filteredGames for modal navigation
                filteredGames.push(game);
            }

            // Create last special card
            const lastCard = createViewAllCard(con, randomCoverImage, totalGamesCount);
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
        }

        // Initialize focus on the first game item
        focusedRowIndex = 0;
        focusedColumnIndex = 0;
        desiredColumnIndex = 0; // Initialize desiredColumnIndex
        if (gameItemsGrid.length > 0 && gameItemsGrid[0].length > 0) {
            focusGameItem(gameItemsGrid[0][0]);
        }

        // Removed lazyLoadImages call
        // lazyLoadImages();
    }

    // Function to create a game item element
    function createGameItem(game) {
        const div = document.createElement('div');
        div.classList.add('game-item');
        div.dataset.gameTitle = game.Title;
        div.dataset.consoleFile = game.ConsoleFile; // Custom property to keep track

        const img = document.createElement('img');
        // Removed lazy loading
        // img.loading = 'lazy';

        if (game.CoverImage) {
            if (game.CoverImage.startsWith('http://') || game.CoverImage.startsWith('https://')) {
                img.src = game.CoverImage; // Set src directly
            } else {
                if (!window.api.path) {
                    console.error('window.api.path is undefined.');
                    displayError('Internal error: Path module is not available.');
                    return div;
                }
                const coverPath = window.api.path.join(window.api.appDir, game.CoverImage);
                img.src = 'file://' + coverPath; // Set src directly
            }
        } else {
            img.src = ''; // Placeholder image if needed
            // Alternatively, set to a default placeholder image:
            // img.src = 'path/to/placeholder/image.png';
        }
        img.alt = game.Title;
        img.setAttribute('aria-label', game.Title);

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

        let hoverTimeout;

        div.addEventListener('mouseenter', () => {
            hoverTimeout = setTimeout(() => {
                setBackgroundImage(game);
            }, 500); // Adjusted to 500ms
        });

        div.addEventListener('mouseleave', () => {
            clearTimeout(hoverTimeout);
            clearBackgroundImage();
        });

        // Handle focus events for keyboard and controller navigation
        div.addEventListener('focus', () => {
            hoverTimeout = setTimeout(() => {
                setBackgroundImage(game);
            }, 500);
        });

        div.addEventListener('blur', () => {
            clearTimeout(hoverTimeout);
            clearBackgroundImage();
        });

        div.setAttribute('tabindex', '0'); // Make div focusable

        div.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                div.click();
            }
        });

        // Store references for navigation
        div.gameData = { game };

        return div;
    }

    // Function to create the 'View All' card
    function createViewAllCard(con, coverImage, totalGamesCount) { // Changed 'console' to 'con'
        const div = document.createElement('div');
        div.classList.add('game-item', 'view-all-card'); // Added 'view-all-card' class
        div.dataset.consoleFile = con.file; // Custom property

        const img = document.createElement('img');
        // Removed lazy loading
        // img.loading = 'lazy';

        if (coverImage) {
            if (coverImage.startsWith('http://') || coverImage.startsWith('https://')) {
                img.src = coverImage; // Set src directly
            } else {
                if (!window.api.path) {
                    console.error('window.api.path is undefined.');
                    displayError('Internal error: Path module is not available.');
                    return div;
                }
                const coverPath = window.api.path.join(window.api.appDir, coverImage);
                img.src = 'file://' + coverPath; // Set src directly
            }
        } else {
            img.src = ''; // Placeholder image if needed
            // Alternatively, set to a default placeholder image:
            // img.src = 'path/to/placeholder/image.png';
        }
        img.alt = con.console;
        img.setAttribute('aria-label', `View all games for ${con.console}`);

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
            loadFullConsoleLibrary(con);
        });

        div.setAttribute('tabindex', '0');
        div.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                div.click();
            }
        });

        return div;
    }

    // Function to load full console library
    async function loadFullConsoleLibrary(con) { // Changed 'console' to 'con'
        let games;
        try {
            showLoadingSpinner();

            // Check if games are already cached
            if (consoleGamesCache[con.file + '_library']) {
                games = consoleGamesCache[con.file + '_library'];
            } else {
                games = await window.api.getGamesForConsole(con.file); // Async call
                console.log(`Loaded games for library view of ${con.console}:`, games); // Debugging Line
                if (!Array.isArray(games)) {
                    throw new Error(`getGamesForConsole() did not return an array for console ${con.console}.`);
                }

                if (!showGamesWithoutImages) {
                    games = games.filter((game) => game.CoverImage);
                }
                consoleGamesCache[con.file + '_library'] = games; // Cache the library games
            }

            filteredGames = games; // Used for search and filtering
        } catch (error) {
            console.error('Failed to load games for the selected console:', error);
            displayError('Failed to load games for the selected console.');
            return;
        } finally {
            hideLoadingSpinner();
        }

        if (!mainContent) {
            console.error('mainContent element not found.');
            displayError('Main content element is missing.');
            return;
        }

        mainContent.innerHTML = '';
        gameItemsGrid = [];
        currentView = 'library';

        // Build alphabet list
        buildAlphabetNav(filteredGames);

        const consoleHeader = document.createElement('h2');
        consoleHeader.textContent = con.console;

        // Show search bar
        if (searchBar) {
            searchBar.classList.remove('hidden');
            searchBar.value = ''; // Clear search bar
        }

        const gamesGrid = document.createElement('div');
        gamesGrid.classList.add('games-grid');

        renderGamesGrid(filteredGames, gamesGrid);

        mainContent.appendChild(consoleHeader);
        mainContent.appendChild(gamesGrid);

        // Initialize focus on the first game item
        focusedRowIndex = 0;
        focusedColumnIndex = 0;
        desiredColumnIndex = 0; // Reset desiredColumnIndex
        isAlphabetNavActive = false;
        if (gameItemsGrid.length > 0 && gameItemsGrid[0].length > 0) {
            focusGameItem(gameItemsGrid[0][0]);
        }

        // Removed lazyLoadImages call
        // lazyLoadImages();
    }

    // Function to render games in the grid
    function renderGamesGrid(games, container) {
        if (!container) {
            console.error('Games grid container not found.');
            displayError('Games grid container is missing.');
            return;
        }

        container.innerHTML = ''; // Clear existing content
        gameItemsGrid = [];

        const gameItemWidth = 220; // Approximate width per game item, include margin
        const itemsPerRow = Math.floor(mainContent.clientWidth / gameItemWidth) || 1; // Ensure at least 1 item per row
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
            container.appendChild(gameItem);
        });
    }

    // Function to build the alphabet navigation bar
    function buildAlphabetNav(games) {
        if (!alphabetNav || !alphabetList) {
            console.error('Alphabet navigation elements not found.');
            displayError('Alphabet navigation elements are missing.');
            return;
        }

        // Extract unique first letters
        const lettersSet = new Set();
        games.forEach((game) => {
            if (!game.Title || typeof game.Title !== 'string') return; // Skip invalid titles
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
            li.setAttribute('tabindex', '0');

            li.addEventListener('click', () => {
                jumpToLetter(letter);
            });
            li.addEventListener('mouseenter', () => {
                focusAlphabetItem(index);
                isAlphabetNavActive = true;
            });
            li.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    li.click();
                }
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

        // Focus the item for focus and blur events
        if (lastInputMethod === 'keyboard' || lastInputMethod === 'controller') {
            item.focus();
        }

        // Scroll into view if needed
        item.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center',
        });
    }

    // Function to focus on an alphabet item
    function focusAlphabetItem(index) {
        if (!alphabetList) return;

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
            item.focus();
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
                if (!item || !item.gameData || !item.gameData.game) continue;
                const gameTitle = item.gameData.game.Title;
                if (!gameTitle || typeof gameTitle !== 'string') continue;
                const firstChar = gameTitle[0].toUpperCase();
                const itemLetter = /^[A-Z]$/.test(firstChar) ? firstChar : '#';
                if (itemLetter === letter) {
                    focusedRowIndex = r;
                    focusedColumnIndex = c;
                    desiredColumnIndex = c; // Update desiredColumnIndex
                    isAlphabetNavActive = false;
                    focusGameItem(item);
                    return;
                }
            }
        }
    }

    // Function to get the next valid item with edge case handling
    function getNextValidItem(rowIndex, columnIndex, direction) {
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

    // Event listener for keydown events without throttling
    document.addEventListener('keydown', handleKeyDown, { passive: false });

    async function handleKeyDown(event) {
        // Ignore events when focused on input elements
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
            return;
        }

        const keysToPrevent = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape', 'Backspace', ' '];
        if (keysToPrevent.includes(event.key)) {
            event.preventDefault(); // Prevent default browser action
            event.stopPropagation(); // Stop the event from bubbling up
        }

        if (isGameRunning) return; // Prevent input when game is running

        lastInputMethod = 'keyboard'; // Update the input method

        if (
            gameModal.classList.contains('hidden') &&
            !sideMenu.classList.contains('open') &&
            settingsModal.classList.contains('hidden')
        ) {
            if (event.key === 'Escape') {
                // Send quit-app message
                window.api.quitApp();
                return;
            }
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
        } else if (!settingsModal.classList.contains('hidden')) {
            // Settings modal is open
            handleKeyboardSettingsNavigation(event);
        }
    }

    // Function to handle keyboard navigation on the front page
    function handleKeyboardFrontPageNavigation(event) {
        let nextItem = null;
        switch (event.key) {
            case 'ArrowLeft':
                focusedColumnIndex = Math.max(focusedColumnIndex - 1, 0);
                desiredColumnIndex = focusedColumnIndex; // Update desiredColumnIndex
                nextItem = getNextValidItem(focusedRowIndex, focusedColumnIndex, 'left');
                break;
            case 'ArrowRight':
                focusedColumnIndex += 1;
                desiredColumnIndex = focusedColumnIndex; // Update desiredColumnIndex
                nextItem = getNextValidItem(focusedRowIndex, focusedColumnIndex, 'right');
                if (!nextItem) {
                    focusedColumnIndex -= 1; // Reset to previous if no next item
                }
                break;
            case 'ArrowUp':
                focusedRowIndex = Math.max(focusedRowIndex - 1, 0);
                nextItem = getNextValidItem(focusedRowIndex, desiredColumnIndex, 'up');
                if (!nextItem) {
                    focusedRowIndex += 1; // Reset if no item found
                } else {
                    focusedColumnIndex = desiredColumnIndex;
                }
                break;
            case 'ArrowDown':
                focusedRowIndex += 1;
                nextItem = getNextValidItem(focusedRowIndex, desiredColumnIndex, 'down');
                if (!nextItem) {
                    focusedRowIndex -= 1; // Reset if no item found
                } else {
                    focusedColumnIndex = desiredColumnIndex;
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

    // Function to handle keyboard navigation in game items
    function handleKeyboardGameItemNavigation(event) {
        let nextItem = null;
        switch (event.key) {
            case 'ArrowLeft':
                focusedColumnIndex = Math.max(focusedColumnIndex - 1, 0);
                desiredColumnIndex = focusedColumnIndex; // Update desiredColumnIndex
                nextItem = getNextValidItem(focusedRowIndex, focusedColumnIndex, 'left');
                break;
            case 'ArrowRight':
                focusedColumnIndex += 1;
                desiredColumnIndex = focusedColumnIndex; // Update desiredColumnIndex
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
                nextItem = getNextValidItem(focusedRowIndex, desiredColumnIndex, 'up');
                if (nextItem) {
                    focusedColumnIndex = desiredColumnIndex;
                } else {
                    focusedRowIndex += 1; // Reset if no item found
                }
                break;
            case 'ArrowDown':
                focusedRowIndex += 1;
                nextItem = getNextValidItem(focusedRowIndex, desiredColumnIndex, 'down');
                if (nextItem) {
                    focusedColumnIndex = desiredColumnIndex;
                } else {
                    focusedRowIndex -= 1; // Reset if no item found
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

    // Function to handle keyboard navigation in the modal
    function handleKeyboardModalNavigation(event) {
        switch (event.key) {
            case 'Escape':
            case 'Backspace':
                closeGameModal();
                break;
            case 'ArrowLeft':
                navigateModal('prev');
                break;
            case 'ArrowRight':
                navigateModal('next');
                break;
            case 'Enter':
                if (modalLaunchButton) {
                    modalLaunchButton.click();
                }
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

    // Function to handle keyboard navigation in the settings modal
    function handleKeyboardSettingsNavigation(event) {
        switch (event.key) {
            case 'Escape':
            case 'Backspace':
                if (settingsModal) {
                    settingsModal.classList.add('hidden');
                }
                break;
            default:
                break;
        }
    }

    // Function to focus on a menu item
    function focusMenuItem(item) {
        if (!item) return;

        // Remove focus class from previous item
        const focusedElements = document.querySelectorAll('#consoleList li.focused');
        focusedElements.forEach((el) => el.classList.remove('focused'));

        item.classList.add('focused');

        // Focus the item for focus and blur events
        item.focus();

        // Scroll into view if needed
        item.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
        });
    }

    // Function to open game modal and display details
    function openGameModal(game) {
        if (!modalGameTitle || !modalGameDescription || !modalBackground || !modalGameCover) {
            console.error('Modal elements are missing.');
            displayError('Game modal elements are missing.');
            return;
        }

        modalGameTitle.textContent = game.Title;
        modalGameDescription.textContent = game.Description || 'No description available.';

        // Set modal background image
        if (game.CoverImage) {
            let imageUrl;
            if (game.CoverImage.startsWith('http://') || game.CoverImage.startsWith('https://')) {
                imageUrl = game.CoverImage;
            } else {
                if (!window.api.path) {
                    console.error('window.api.path is undefined.');
                    displayError('Internal error: Path module is not available.');
                    return;
                }
                const coverPath = window.api.path.join(window.api.appDir, game.CoverImage);
                imageUrl = 'file://' + coverPath;
            }
            modalBackground.style.backgroundImage = `url(${imageUrl})`;
            modalGameCover.src = imageUrl;
            modalGameCover.alt = game.Title;
        } else {
            modalBackground.style.backgroundImage = '';
            modalGameCover.src = '';
        }

        gameModal.classList.remove('hidden');
        if (modalLaunchButton) {
            modalLaunchButton.focus();
        }
    }

    // Close modal function
    function closeGameModal() {
        if (!gameModal) return;
        gameModal.classList.add('hidden');
        selectedGame = null;
    }

    // Function to navigate between games in the modal
    function navigateModal(direction) {
        if (!filteredGames || filteredGames.length === 0) return;

        const currentIndex = filteredGames.findIndex(game => game.Title === selectedGame.Title);
        let newIndex;

        if (direction === 'prev') {
            newIndex = (currentIndex - 1 + filteredGames.length) % filteredGames.length;
        } else {
            newIndex = (currentIndex + 1) % filteredGames.length;
        }

        selectedGame = filteredGames[newIndex];
        openGameModal(selectedGame);
    }

    // Event listeners for modal buttons
    if (modalCloseButton) {
        modalCloseButton.addEventListener('click', closeGameModal);
    }

    if (modalLaunchButton) {
        modalLaunchButton.addEventListener('click', () => {
            if (selectedGame) {
                const corePath = selectedGame.CorePath;
                const romPath = selectedGame.RomPaths[0]; // Use the first ROM path
                try {
                    window.api.launchGame(corePath, romPath);
                    isGameRunning = true; // Set flag when game starts
                    closeGameModal();
                } catch (error) {
                    console.error('Failed to launch the game:', error);
                    displayError('Failed to launch the game.');
                }
            }
        });
    }

    if (modalPrevButton) {
        modalPrevButton.addEventListener('click', () => {
            navigateModal('prev');
        });
    }

    if (modalNextButton) {
        modalNextButton.addEventListener('click', () => {
            navigateModal('next');
        });
    }

    // Close modal when clicking outside the modal body
    if (gameModal) {
        gameModal.addEventListener('click', (e) => {
            if (e.target === gameModal) {
                closeGameModal();
            }
        });
    }

    // Side menu event listeners
    if (openMenuButton) {
        openMenuButton.addEventListener('click', openSideMenu);
    }
    if (closeMenuButton) {
        closeMenuButton.addEventListener('click', closeSideMenu);
    }
    if (menuOverlay) {
        menuOverlay.addEventListener('click', closeSideMenu);
    }
    if (exitAppButton) {
        exitAppButton.addEventListener('click', () => {
            window.api.quitApp();
        });
    }

    function openSideMenu() {
        if (!sideMenu || !menuOverlay || !consoleList) {
            console.error('Side menu elements are missing.');
            displayError('Side menu elements are missing.');
            return;
        }

        sideMenu.classList.add('open');
        menuOverlay.classList.remove('hidden');
        // Focus first menu item
        focusedMenuIndex = 0;
        if (consoleList.children.length > 0) {
            focusMenuItem(consoleList.children[focusedMenuIndex]);
        }
        sideMenu.focus();
    }

    function closeSideMenu() {
        if (!sideMenu || !menuOverlay || !consoleList) return;

        sideMenu.classList.remove('open');
        menuOverlay.classList.add('hidden');
        // Remove focus from menu items
        const focusedElements = document.querySelectorAll('#consoleList li.focused');
        focusedElements.forEach((el) => el.classList.remove('focused'));
    }

    // Event listener for 'Home' button
    if (homeButton) {
        homeButton.addEventListener('click', () => {
            if (searchBar) {
                searchBar.classList.add('hidden');
            }
            populateFrontPage(allConsoles);
        });
    }

    // Settings event listeners
    if (settingsButton) {
        settingsButton.addEventListener('click', () => {
            if (!settingsModal) {
                console.error('Settings modal element not found.');
                displayError('Settings modal element is missing.');
                return;
            }
            settingsModal.classList.remove('hidden');
            settingsModal.focus();
        });
    }

    if (settingsCloseButton) {
        settingsCloseButton.addEventListener('click', () => {
            if (!settingsModal) return;
            settingsModal.classList.add('hidden');
        });
    }

    // Initialize settings checkboxes and selects
    if (showGamesWithoutImagesCheckbox) {
        showGamesWithoutImagesCheckbox.checked = showGamesWithoutImages;
    }
    if (fontSelect) {
        fontSelect.value = selectedFont;
    }
    if (fontSizeSelect) {
        fontSizeSelect.value = selectedFontSize;
    }

    if (showGamesWithoutImagesCheckbox) {
        showGamesWithoutImagesCheckbox.addEventListener('change', () => {
            showGamesWithoutImages = showGamesWithoutImagesCheckbox.checked;
            savePreference('showGamesWithoutImages', showGamesWithoutImages);
            // Reload current view
            if (currentView === 'library') {
                loadFullConsoleLibrary(allConsoles[focusedConsoleIndex]);
            } else {
                populateFrontPage(allConsoles);
            }
        });
    }

    if (fontSelect) {
        fontSelect.addEventListener('change', () => {
            selectedFont = fontSelect.value;
            savePreference('selectedFont', selectedFont);
            applyFontPreferences();
        });
    }

    if (fontSizeSelect) {
        fontSizeSelect.addEventListener('change', () => {
            selectedFontSize = fontSizeSelect.value;
            savePreference('selectedFontSize', selectedFontSize);
            applyFontPreferences();
        });
    }

    // Function to apply font preferences
    function applyFontPreferences() {
        document.body.style.fontFamily = `'${selectedFont}', sans-serif`;

        // Apply font size
        if (selectedFontSize === 'small') {
            document.body.style.fontSize = '12px';
        } else if (selectedFontSize === 'large') {
            document.body.style.fontSize = '18px';
        } else {
            document.body.style.fontSize = '16px';
        }

        // Update Google Fonts link dynamically
        const existingLink = document.getElementById('dynamic-font-link');
        if (existingLink) {
            existingLink.remove();
        }

        const fontLink = document.createElement('link');
        fontLink.id = 'dynamic-font-link';
        fontLink.rel = 'stylesheet';
        fontLink.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(selectedFont)}&display=swap`;
        document.head.appendChild(fontLink);
    }

    // Search functionality
    if (searchBar) {
        searchBar.addEventListener('input', () => {
            const query = searchBar.value.toLowerCase();
            filterGames(query);
        });
    }

    async function filterGames(query) {
        if (!allGames) return;

        try {
            filteredGames = allGames.filter(game => game.Title.toLowerCase().includes(query));
            if (!showGamesWithoutImages) {
                filteredGames = filteredGames.filter(game => game.CoverImage);
            }
            const gamesGrid = document.querySelector('.games-grid');
            if (gamesGrid) {
                renderGamesGrid(filteredGames, gamesGrid);
                // Removed lazyLoadImages call
                // lazyLoadImages();
            }
        } catch (error) {
            console.error('Error filtering games:', error);
            displayError('Failed to filter games.');
        }
    }

    // Utility functions
    function showLoadingSpinner() {
        if (loadingSpinner) {
            loadingSpinner.classList.remove('hidden');
        }
    }

    function hideLoadingSpinner() {
        if (loadingSpinner) {
            loadingSpinner.classList.add('hidden');
        }
    }

    function savePreference(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error(`Error saving preference for key "${key}":`, error);
        }
    }

    function loadPreference(key) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error(`Error loading preference for key "${key}":`, error);
            return null;
        }
    }

    // Utility function to shuffle an array
    function shuffleArray(array) {
        return array.sort(() => Math.random() - 0.5);
    }

    // Listen for 'game-ended' event from main process and dispatch a custom event
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

    document.addEventListener('keyup', () => {
        if (lastInputMethod !== 'keyboard') {
            lastInputMethod = 'keyboard';
        }
    });

    // Ensure focus is visible only for keyboard navigation
    function updateFocusStyles() {
        const styleElement = document.getElementById('dynamic-focus-style');
        if (styleElement) {
            styleElement.remove();
        }
        const style = document.createElement('style');
        style.id = 'dynamic-focus-style';
        style.innerHTML = `
            .game-item:focus {
                outline: none;
            }
            ${lastInputMethod === 'keyboard' || lastInputMethod === 'controller' ? `
            .game-item.focused {
                border: 3px solid #e50914;
                transform: scale(1.05);
            }` : `
            .game-item.focused {
                border: none;
                transform: none;
            }`}
        `;
        document.head.appendChild(style);
    }

    setInterval(updateFocusStyles, 500); // Update focus styles periodically

    // Functions to handle background image during hover
    function setBackgroundImage(game) {
        let imageUrl = '';
        if (game.BackgroundImage) {
            if (game.BackgroundImage.startsWith('http://') || game.BackgroundImage.startsWith('https://')) {
                imageUrl = game.BackgroundImage;
            } else {
                if (!window.api.path) {
                    console.error('window.api.path is undefined.');
                    displayError('Internal error: Path module is not available.');
                    return;
                }
                const backgroundPath = window.api.path.join(window.api.appDir, game.BackgroundImage);
                imageUrl = 'file://' + backgroundPath;
            }
        } else if (game.CoverImage) {
            if (game.CoverImage.startsWith('http://') || game.CoverImage.startsWith('https://')) {
                imageUrl = game.CoverImage;
            } else {
                if (!window.api.path) {
                    console.error('window.api.path is undefined.');
                    displayError('Internal error: Path module is not available.');
                    return;
                }
                const coverPath = window.api.path.join(window.api.appDir, game.CoverImage);
                imageUrl = 'file://' + coverPath;
            }
        }

        if (imageUrl && backgroundOverlay) {
            backgroundOverlay.style.backgroundImage = `url(${imageUrl})`;
            backgroundOverlay.classList.remove('hidden');
            backgroundOverlay.style.opacity = '0.5'; // Fade to 50% over transition
        }
    }

    function clearBackgroundImage() {
        if (backgroundOverlay) {
            backgroundOverlay.style.opacity = '0';
            setTimeout(() => {
                backgroundOverlay.classList.add('hidden');
                backgroundOverlay.style.backgroundImage = '';
            }, 500); // Wait for the transition to complete
        }
    }

    // Removed lazyLoadImages function and related code

    // Gamepad support
    let gamepadIndex = null;
    let gamepadDebounce = false;

    // Variables for detecting double-click and long-press on Select button
    let selectButtonPressed = false;
    let selectButtonPressStartTime = null;
    let lastSelectButtonPressTime = 0;
    let selectButtonClickCount = 0;

    function gamepadLoop() {
        if (isGameRunning) {
            requestAnimationFrame(gamepadLoop);
            return; // Prevent input when game is running
        }

        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        let gamepad = null;
        if (gamepadIndex !== null) {
            gamepad = gamepads[gamepadIndex];
        }
        if (!gamepad) {
            for (let i = 0; i < gamepads.length; i++) {
                if (gamepads[i]) {
                    gamepad = gamepads[i];
                    gamepadIndex = i;
                    console.log(`Gamepad connected: ${gamepad.id} at index ${i}`);
                    break;
                }
            }
        }

        if (gamepad) {
            // Safely access buttons using optional chaining and type checking
            const up =
                gamepad.buttons?.[12]?.pressed ||
                (typeof gamepad.axes[1] === 'number' && gamepad.axes[1] < -0.5);
            const down =
                gamepad.buttons?.[13]?.pressed ||
                (typeof gamepad.axes[1] === 'number' && gamepad.axes[1] > 0.5);
            const left =
                gamepad.buttons?.[14]?.pressed ||
                (typeof gamepad.axes[0] === 'number' && gamepad.axes[0] < -0.5);
            const right =
                gamepad.buttons?.[15]?.pressed ||
                (typeof gamepad.axes[0] === 'number' && gamepad.axes[0] > 0.5);
            const aButton = gamepad.buttons?.[0]?.pressed; // 'A' button
            const bButton = gamepad.buttons?.[1]?.pressed; // 'B' button
            const startButton = gamepad.buttons?.[9]?.pressed; // 'Start' button
            const selectButton = gamepad.buttons?.[8]?.pressed; // 'Select' button
            const lb = gamepad.buttons?.[4]?.pressed; // 'LB' button
            const rb = gamepad.buttons?.[5]?.pressed; // 'RB' button

            if (!gamepadDebounce) {
                lastInputMethod = 'controller'; // Update the input method

                // Handle Select button for double-click or long-press to close the system
                if (selectButton) {
                    if (!selectButtonPressed) {
                        selectButtonPressed = true;
                        const now = Date.now();
                        if (now - lastSelectButtonPressTime < 500) {
                            // Double click detected
                            selectButtonClickCount += 1;
                        } else {
                            // New click
                            selectButtonClickCount = 1;
                        }
                        lastSelectButtonPressTime = now;
                        selectButtonPressStartTime = now;
                    } else {
                        // Button is still pressed, check for long press
                        const now = Date.now();
                        if (now - selectButtonPressStartTime >= 2000) {
                            // Long press detected
                            window.api.quitApp();
                            selectButtonPressed = false;
                            selectButtonClickCount = 0;
                            setGamepadDebounce();
                            return;
                        }
                    }
                } else if (selectButtonPressed) {
                    // Button was released
                    const now = Date.now();
                    selectButtonPressed = false;
                    if (selectButtonClickCount === 2 && (now - lastSelectButtonPressTime) < 500) {
                        // Double click detected
                        window.api.quitApp();
                        selectButtonClickCount = 0;
                        setGamepadDebounce();
                        return;
                    }
                }

                // Handle Start button to open/close side menu
                if (startButton) {
                    if (sideMenu.classList.contains('open')) {
                        closeSideMenu();
                    } else {
                        openSideMenu();
                    }
                    setGamepadDebounce();
                }

                // Handle 'A' button to select the focused game item (open modal)
                if (aButton) {
                    if (gameModal.classList.contains('hidden')) {
                        const focusedItem = getNextItem(focusedRowIndex, focusedColumnIndex);
                        if (focusedItem && focusedItem.gameData && focusedItem.gameData.game) {
                            selectedGame = focusedItem.gameData.game;
                            openGameModal(selectedGame);
                        }
                    } else {
                        // Modal is open
                        if (modalLaunchButton) {
                            modalLaunchButton.click();
                        }
                    }
                    setGamepadDebounce();
                }

                // Handle 'B' button for various actions
                if (bButton) {
                    if (!gameModal.classList.contains('hidden')) {
                        // Modal is open
                        closeGameModal();
                        setGamepadDebounce();
                    } else if (!settingsModal.classList.contains('hidden')) {
                        // Settings modal is open
                        settingsModal.classList.add('hidden');
                        setGamepadDebounce();
                    } else if (currentView !== 'frontPage') {
                        // Go back to front page
                        populateFrontPage(allConsoles);
                        setGamepadDebounce();
                    }
                }

                // Navigation and other controls
                if (sideMenu.classList.contains('open')) {
                    // Side menu is open
                    if (up) {
                        focusedMenuIndex = Math.max(focusedMenuIndex - 1, 0);
                        focusMenuItem(consoleList.children[focusedMenuIndex]);
                        setGamepadDebounce();
                    } else if (down) {
                        focusedMenuIndex = Math.min(
                            focusedMenuIndex + 1,
                            consoleList.children.length - 1
                        );
                        focusMenuItem(consoleList.children[focusedMenuIndex]);
                        setGamepadDebounce();
                    } else if (aButton) {
                        // Trigger click on focused menu item
                        const focusedItem = consoleList.children[focusedMenuIndex];
                        if (focusedItem) {
                            focusedItem.click();
                        }
                        setGamepadDebounce();
                    }
                } else if (
                    gameModal.classList.contains('hidden') &&
                    !sideMenu.classList.contains('open') &&
                    settingsModal.classList.contains('hidden')
                ) {
                    // Navigation in main content
                    if (currentView === 'library') {
                        if (isAlphabetNavActive) {
                            // Alphabet navigation
                            if (up) {
                                focusAlphabetItem(alphabetFocusedIndex - 1);
                                setGamepadDebounce();
                            } else if (down) {
                                focusAlphabetItem(alphabetFocusedIndex + 1);
                                setGamepadDebounce();
                            } else if (aButton) {
                                const selectedLetter = alphabet[alphabetFocusedIndex];
                                jumpToLetter(selectedLetter);
                                setGamepadDebounce();
                            } else if (left || bButton) {
                                isAlphabetNavActive = false;
                                focusGameItem(getNextItem(focusedRowIndex, focusedColumnIndex));
                                setGamepadDebounce();
                            }
                        } else {
                            // Game items navigation
                            let nextItem = null;
                            if (up) {
                                focusedRowIndex = Math.max(focusedRowIndex - 1, 0);
                                nextItem = getNextValidItem(
                                    focusedRowIndex,
                                    desiredColumnIndex,
                                    'up'
                                );
                                if (nextItem) {
                                    focusedColumnIndex = desiredColumnIndex;
                                } else {
                                    focusedRowIndex += 1; // Reset if no item found
                                }
                                setGamepadDebounce();
                            } else if (down) {
                                focusedRowIndex += 1;
                                nextItem = getNextValidItem(
                                    focusedRowIndex,
                                    desiredColumnIndex,
                                    'down'
                                );
                                if (nextItem) {
                                    focusedColumnIndex = desiredColumnIndex;
                                } else {
                                    focusedRowIndex -= 1; // Reset if no item found
                                }
                                setGamepadDebounce();
                            } else if (left) {
                                focusedColumnIndex = Math.max(focusedColumnIndex - 1, 0);
                                desiredColumnIndex = focusedColumnIndex; // Update desiredColumnIndex
                                nextItem = getNextValidItem(
                                    focusedRowIndex,
                                    focusedColumnIndex,
                                    'left'
                                );
                                setGamepadDebounce();
                            } else if (right) {
                                focusedColumnIndex += 1;
                                desiredColumnIndex = focusedColumnIndex; // Update desiredColumnIndex
                                nextItem = getNextValidItem(
                                    focusedRowIndex,
                                    focusedColumnIndex,
                                    'right'
                                );
                                if (!nextItem) {
                                    // Move to alphabet nav
                                    isAlphabetNavActive = true;
                                    focusAlphabetItem(alphabetFocusedIndex);
                                    setGamepadDebounce();
                                    return;
                                }
                                setGamepadDebounce();
                            }

                            if (nextItem) {
                                focusGameItem(nextItem);
                            }
                        }
                    } else {
                        // Front page navigation
                        let nextItem = null;
                        if (up) {
                            focusedRowIndex = Math.max(focusedRowIndex - 1, 0);
                            nextItem = getNextValidItem(
                                focusedRowIndex,
                                desiredColumnIndex,
                                'up'
                            );
                            if (nextItem) {
                                focusedColumnIndex = desiredColumnIndex;
                            } else {
                                focusedRowIndex += 1; // Reset if no item found
                            }
                            setGamepadDebounce();
                        } else if (down) {
                            focusedRowIndex += 1;
                            nextItem = getNextValidItem(
                                focusedRowIndex,
                                desiredColumnIndex,
                                'down'
                            );
                            if (nextItem) {
                                focusedColumnIndex = desiredColumnIndex;
                            } else {
                                focusedRowIndex -= 1; // Reset if no item found
                            }
                            setGamepadDebounce();
                        } else if (left) {
                            focusedColumnIndex = Math.max(focusedColumnIndex - 1, 0);
                            desiredColumnIndex = focusedColumnIndex; // Update desiredColumnIndex
                            nextItem = getNextValidItem(
                                focusedRowIndex,
                                focusedColumnIndex,
                                'left'
                            );
                            setGamepadDebounce();
                        } else if (right) {
                            focusedColumnIndex += 1;
                            desiredColumnIndex = focusedColumnIndex; // Update desiredColumnIndex
                            nextItem = getNextValidItem(
                                focusedRowIndex,
                                focusedColumnIndex,
                                'right'
                            );
                            if (!nextItem) {
                                focusedColumnIndex -= 1; // Reset to previous if no next item
                            }
                            setGamepadDebounce();
                        }

                        if (nextItem) {
                            focusGameItem(nextItem);
                        }
                    }
                } else if (!gameModal.classList.contains('hidden')) {
                    // Modal is open
                    if (left || lb) {
                        navigateModal('prev');
                        setGamepadDebounce();
                    } else if (right || rb) {
                        navigateModal('next');
                        setGamepadDebounce();
                    }
                }
            }

            // Continue the gamepad loop
            requestAnimationFrame(gamepadLoop);
        } else {
            // No gamepad detected
            requestAnimationFrame(gamepadLoop);
        }
    }

    function setGamepadDebounce(duration = 100) {
        gamepadDebounce = true;
        setTimeout(() => {
            gamepadDebounce = false;
        }, duration);
    }

    // Start gamepad loop immediately
    gamepadLoop();

    window.addEventListener('gamepadconnected', (e) => {
        gamepadIndex = e.gamepad.index;
        console.log('Gamepad connected:', e.gamepad.id);
    });

    window.addEventListener('gamepaddisconnected', (e) => {
        if (gamepadIndex === e.gamepad.index) {
            gamepadIndex = null;
            console.log('Gamepad disconnected:', e.gamepad.id);
        }
    });
});
