/**
 * buildGamesJson.js
 *
 * Major Enhancements:
 *  1) Parallel Requests (worker pool) with concurrency read from config.
 *  2) Rate-limiting to never exceed 4 requests/sec (token-bucket approach).
 *  3) Adaptive Rate: if repeated 429, reduce concurrency by half.
 *  4) Lazy asset download if configured: only store URLs, no local images saved.
 *  5) Offline mode: skip IGDB entirely.
 *  6) Additional IGDB fields (storyline, category, status, etc.).
 *  7) Genre hierarchies (store in "NestedGenres" field).
 *  8) Automated tag generation from multiple fields.
 *  9) Detailed JSON schema + optional validation with ajv.
 * 10) Configuration-based toggles in config.ini
 *
 * Change: Now we store one JSON per console in "data" folder, plus a
 * "consoles_index.json" referencing all console JSON files.
 *
 * Explanation: This script rummages through your ROM directories like a raccoon
 * searching for pizza crusts in the garbage. For each discovered ROM, we attempt
 * to fetch metadata from IGDB (unless you've chosen to starve the script in Offline Mode),
 * then store the results in neat, JSON-based scrapbooks.
 *
 * Some parts of this code are borderline necromancy: concurrency-limiting, token-bucket
 * rate-limiting, adaptive meltdown (429 handling) — but we have the power of Node.js
 * and your config file to keep these demons at bay.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const chalk = require('chalk');
const cliProgress = require('cli-progress');
const stringSimilarity = require('string-similarity');
const util = require('util');
const ini = require('ini');
const Ajv = require('ajv'); // For JSON schema validation (npm install ajv)

// Because asynchronous code loves to keep us waiting, let's use a promisified version of setTimeout.
const setTimeoutPromise = util.promisify(setTimeout);

/* -------------------------------------------
 * 1) LOAD CONFIG.INI
 * -------------------------------------------
 * We love .ini files like we love unlabeled potions in a wizard's lab.
 * We'll parse them in hopes we find the correct configuration,
 * or at least not awaken a cursed config demon.
 */

const CONFIG_PATH = path.join(__dirname, 'config.ini');
if (!fs.existsSync(CONFIG_PATH)) {
  console.error(chalk.red(`[ERROR] Missing config.ini at: ${CONFIG_PATH}`));
  process.exit(1);
}

const config = ini.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

// Path to where the Roms live (like your local morgue for game files).
const BASE_ROMS_PATH = config.Paths?.RomsPath || 'C:/RetroArch/Games/Roms';

// Where we store JSON per console
const OUTPUT_FOLDER = config.Paths?.OutputFolder
  ? path.isAbsolute(config.Paths.OutputFolder)
    ? config.Paths.OutputFolder
    : path.join(__dirname, config.Paths.OutputFolder)
  : path.join(__dirname, 'data');

// The index JSON that references all per-console JSON files
const CONSOLE_INDEX_PATH = path.join(OUTPUT_FOLDER, 'consoles_index.json');

// Where we store images (if not lazy)
const IMAGES_PATH = path.isAbsolute(config.Paths?.ImagesFolder || '')
  ? config.Paths.ImagesFolder
  : path.join(__dirname, config.Paths?.ImagesFolder || 'data/images');

const CORE_BASE = config.Paths?.CoresFolder || 'C:/RetroArch/win64/cores';

// IGDB Credentials (your keys to the kingdom... or a data meltdown if invalid).
const CLIENT_ID = config.IGDB?.ClientID || '';
const CLIENT_SECRET = config.IGDB?.ClientSecret || '';

// Settings
const SKIP_EXISTING_METADATA = config.Settings?.SkipExistingMetadata === 'true';
const OFFLINE_MODE = config.Settings?.OfflineMode === 'true';
let MAX_CONCURRENCY = parseInt(config.Settings?.Concurrency ?? '2', 10);
if (isNaN(MAX_CONCURRENCY) || MAX_CONCURRENCY < 1) {
  MAX_CONCURRENCY = 2; // fallback to 2, because 0 concurrency is basically a catatonic program
}
const LAZY_DOWNLOAD = config.Settings?.LazyDownload === 'true';
const ADAPTIVE_RATE = config.Settings?.AdaptiveRate === 'true';
const VALIDATE_SCHEMA = config.Settings?.ValidateSchema === 'true';
const TAG_GENERATION = config.Settings?.TagGeneration === 'true';

// Rate-limiting constants
// We refuse to exceed 4 requests/sec. We don't want to face IGDB's wrath, do we?
const MAX_REQUESTS_PER_SECOND = 4;
const TOKEN_BUCKET_SIZE = MAX_REQUESTS_PER_SECOND;
const REFILL_INTERVAL_MS = 1000;

// Save progress after every N entries (because safety nets are good).
const SAVE_EVERY_N = 20;

// For those sad ROMs that couldn't be matched (RIP).
const UNMATCHED_JSON_PATH = path.join(OUTPUT_FOLDER, 'unmatched.json');

// We'll also store console-based JSON, not a single monolithic JSON. Hooray for modular chaos!

// Relative prefix for images in JSON
const IMAGES_URL_PREFIX = path.normalize(
  '/' + path.relative(process.cwd(), IMAGES_PATH).replace(/\\/g, '/')
);

// Acceptable ROM file extensions. No weird .exe or .pdf "ROMs," please.
const VALID_ROM_EXTENSIONS = new Set([
  '.nes', '.sfc', '.smc', '.gba', '.gb', '.gbc', '.n64', '.z64', '.v64',
  '.a26', '.lnx', '.c64', '.col', '.int', '.sms', '.gg', '.pce', '.cue',
  '.iso', '.bin', '.adf', '.rom', '.img', '.chd', '.cso', '.gdi', '.cdi',
  '.zip',
]);

// Our helpful map of console to core paths. If these paths don't exist, we'll politely complain.
const CORE_MAP = {
  'amiga': path.join(CORE_BASE, 'puae_libretro.dll'),
  'atari 2600': path.join(CORE_BASE, 'stella_libretro.dll'),
  'atari 7800': path.join(CORE_BASE, 'prosystem_libretro.dll'),
  'atari lynx': path.join(CORE_BASE, 'handy_libretro.dll'),
  'atari jaguar': path.join(CORE_BASE, 'virtualjaguar_libretro.dll'),
  'colecovision': path.join(CORE_BASE, 'blueMSX_libretro.dll'),
  'commodore 64': path.join(CORE_BASE, 'vice_x64_libretro.dll'),
  'intellivision': path.join(CORE_BASE, 'freeintv_libretro.dll'),
  'neo geo aes': path.join(CORE_BASE, 'fbneo_libretro.dll'),
  'nes': path.join(CORE_BASE, 'nestopia_libretro.dll'),
  'snes': path.join(CORE_BASE, 'snes9x_libretro.dll'),
  'nintendo 64': path.join(CORE_BASE, 'mupen64plus_next_libretro.dll'),
  'game boy': path.join(CORE_BASE, 'sameboy_libretro.dll'),
  'game boy color': path.join(CORE_BASE, 'sameboy_libretro.dll'),
  'game boy advance': path.join(CORE_BASE, 'mgba_libretro.dll'),
  'genesis': path.join(CORE_BASE, 'picodrive_libretro.dll'),
  'sega game gear': path.join(CORE_BASE, 'genesis_plus_gx_libretro.dll'),
  'sega master system': path.join(CORE_BASE, 'genesis_plus_gx_libretro.dll'),
  'dreamcast': path.join(CORE_BASE, 'flycast_libretro.dll'),
  'psx': path.join(CORE_BASE, 'mednafen_psx_libretro.dll'),
  'playstation': path.join(CORE_BASE, 'mednafen_psx_libretro.dll'),
  'turbografx-16': path.join(CORE_BASE, 'mednafen_pce_fast_libretro.dll'),
};

// IGDB platform IDs: because we love numbers that represent archaic hardware.
const PLATFORM_ID_MAP = {
  'amiga': 34,
  'atari 2600': 59,
  'atari 7800': 60,
  'atari lynx': 68,
  'atari jaguar': 62,
  'colecovision': 56,
  'commodore 64': 15,
  'c64': 15,
  'intellivision': 57,
  'neo geo aes': 12,
  'nes': 18,
  'snes': 19,
  'super nintendo': 19,
  'nintendo / snes': 19,
  'nintendo 64': 4,
  'game boy': 33,
  'game boy color': 22,
  'game boy advance': 24,
  'genesis': 29,
  'sega genesis': 29,
  'sega master system': 64,
  'sega game gear': 35,
  'dreamcast': 23,
  'psx': 7,
  'playstation': 7,
  'playstation 1': 7,
  'turbografx-16': 86,
};

// The threshold for fuzzy matching: if it's below 0.4, we might as well guess you typed it with your elbows.
const FUZZY_MATCH_THRESHOLD = 0.4;

// We'll store our IGDB token here like the sweet secret it is.
let accessToken = null;

/* -------------------------------------------
 * 2) LOGGING + VALIDATION HELPERS
 * -------------------------------------------
 * Because ironically, we want to see what's happening before we inevitably bury the logs.
 */
function logError(msg) {
  console.error(chalk.red(`[ERROR] ${msg}`));
}
function logWarning(msg) {
  console.warn(chalk.yellow(`[WARNING] ${msg}`));
}
function logInfo(msg) {
  console.log(chalk.white(`[INFO] ${msg}`));
}
function logSuccess(msg) {
  console.log(chalk.green(`[SUCCESS] ${msg}`));
}

/**
 * Helper to guess player count from game modes (like "multiplayer" -> 2 players).
 * If we can't figure it out, we just assume 1 lonely soul is playing.
 */
function getPlayerCount(gameModes) {
  if (gameModes.some((m) => m.name?.toLowerCase().includes('multiplayer'))) {
    return 2; // Because 2 is more fun than 1, apparently
  }
  return 1; // Forever alone
}

/**
 * For involvedCompanies, return a comma-separated string for a specific role (developer/publisher).
 * We politely ignore everything else. Because who needs the rest? QA? Pfft.
 */
function getCompanies(involvedCompanies, role) {
  if (!involvedCompanies) return '';
  const companies = involvedCompanies.filter((ic) => ic[role]);
  return companies.map((ic) => ic.company.name).join(', ');
}

/**
 * If ageRatings is present, returns them as a comma-separated string (e.g., "ESRB: TEEN, PEGI: 12").
 * If not present, it's back to anarchy.
 */
function getAgeRatings(ageRatings) {
  if (!Array.isArray(ageRatings)) return '';
  return ageRatings.map((ar) => `${ar.category}: ${ar.rating}`).join(', ');
}

/**
 * Because the file system doesn't like certain characters, we purge them like medieval heretics.
 */
function sanitizeForFileName(str) {
  let sanitized = str.replace(/[<>:"/\\|?*]+/g, '').trim();
  while (sanitized.endsWith('.') || sanitized.endsWith(' ')) {
    sanitized = sanitized.slice(0, -1);
  }
  return sanitized;
}

/**
 * Normalizes our images prefix to ensure we start with a slash. Because consistency is king.
 */
function normalizeImagesPrefix() {
  if (!IMAGES_URL_PREFIX.startsWith('/')) {
    return '/' + IMAGES_URL_PREFIX;
  }
  return IMAGES_URL_PREFIX;
}

/**
 * Short path for cover image, to store in JSON. 
 * We stash images in subfolders named after our beloved console and game title.
 */
function getCoverImageShortPath(consoleName, gameTitle) {
  const c = sanitizeForFileName(consoleName);
  const g = sanitizeForFileName(gameTitle);
  return `${normalizeImagesPrefix()}/${c}/${g}/cover.jpg`;
}

/**
 * Short path for screenshots, appended with an index. 
 * Because we can't keep them all named screenshot1.jpg. That'd be chaos.
 */
function getScreenshotShortPath(consoleName, gameTitle, index) {
  const c = sanitizeForFileName(consoleName);
  const g = sanitizeForFileName(gameTitle);
  return `${normalizeImagesPrefix()}/${c}/${g}/screenshots/${index}.jpg`;
}

/**
 * Absolute path for local cover image.
 * If you prefer storing them in your attic, you'll need a different function.
 */
function getCoverImageAbsolutePath(consoleName, gameTitle) {
  const c = sanitizeForFileName(consoleName);
  const g = sanitizeForFileName(gameTitle);
  return path.join(IMAGES_PATH, c, g, 'cover.jpg');
}

/**
 * Absolute path for local screenshots, appended with an index.
 */
function getScreenshotAbsolutePath(consoleName, gameTitle, index) {
  const c = sanitizeForFileName(consoleName);
  const g = sanitizeForFileName(gameTitle);
  return path.join(IMAGES_PATH, c, g, 'screenshots', `${index}.jpg`);
}

/**
 * Given a filename, remove its extension and any bracketed meta info, 
 * leaving the precious base game name. It's like cleaning a skeleton of extraneous meat.
 */
function getBaseGameName(filename) {
  let baseName = filename.replace(/\.[^.]+$/, ''); // remove extension
  baseName = baseName.replace(/[\(\[\{][^\)\]\}]+[\)\]\}]\s*/g, '').trim();
  return baseName;
}

/**
 * Check if the extension is on our VIP list of valid ROM extensions.
 */
function isValidRomExtension(ext) {
  return VALID_ROM_EXTENSIONS.has(ext.toLowerCase());
}

/**
 * Lowercases the title and kills weird punctuation, so we can feed it to fuzzy matching later.
 */
function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Grab the platform ID from our big map, or fail. 
 * We'll do a naive search if it's not found. 
 * You can't hide from us, platform string.
 */
function getPlatformId(consoleName) {
  const normalized = consoleName.toLowerCase();
  if (PLATFORM_ID_MAP[normalized]) {
    return PLATFORM_ID_MAP[normalized];
  }
  for (const [key, val] of Object.entries(PLATFORM_ID_MAP)) {
    if (normalized.includes(key)) {
      return val;
    }
  }
  return null;
}

/**
 * Return the path to the correct emulator core for the console, or an empty string if we have no clue.
 */
function getCorePath(consoleName) {
  const normalized = consoleName.toLowerCase();
  if (CORE_MAP[normalized]) {
    return CORE_MAP[normalized];
  }
  for (const [key, val] of Object.entries(CORE_MAP)) {
    if (normalized.includes(key)) {
      return val;
    }
  }
  return '';
}

/* -------------------------------------------
 * 3) IGDB + TOKEN + OFFLINE
 * -------------------------------------------
 * Because we love IGDB data, but only if we have an access token.
 */
async function getIGDBAccessToken() {
  try {
    const response = await axios.post(
      'https://id.twitch.tv/oauth2/token',
      null,
      {
        params: {
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: 'client_credentials',
        },
      }
    );
    return response.data.access_token;
  } catch (error) {
    logError(`Failed to obtain IGDB access token: ${error.message}`);
    process.exit(1);
  }
}

async function initIGDB() {
  if (OFFLINE_MODE) {
    logInfo(`Offline mode enabled. Skipping IGDB init (we starve ourselves of knowledge).`);
    return;
  }
  if (!CLIENT_ID || !CLIENT_SECRET) {
    logError(`IGDB credentials not set in config.ini (ClientID / ClientSecret). No freebies for you!`);
    process.exit(1);
  }
  accessToken = await getIGDBAccessToken();
}

/* -------------------------------------------
 * 4) RATE LIMIT + WORKER POOL (PARALLEL REQUESTS)
 * -------------------------------------------
 * We conjure a small group of workers, each forging a request to IGDB, 
 * but we limit the pace so we don't incite the banhammer.
 */

let currentConcurrency = 0;
let activeTasks = [];
let tokenBucket = MAX_REQUESTS_PER_SECOND;
let last429Timestamp = 0;

// Refill tokens every second, as if by black magic.
setInterval(() => {
  tokenBucket = MAX_REQUESTS_PER_SECOND;
}, REFILL_INTERVAL_MS);

/**
 * The main function to queue an IGDB request for concurrency-limited execution.
 * We'll return a Promise that resolves to the request data or your tears.
 */
function queueIGDBRequest(fn) {
  return new Promise((resolve, reject) => {
    const task = async () => {
      try {
        // Wait for a precious rate-limit token.
        await waitForToken();
        currentConcurrency++;
        const result = await fn();
        currentConcurrency--;
        resolve(result);
        processNextTask();
      } catch (err) {
        currentConcurrency--;
        reject(err);
        processNextTask();
      }
    };

    activeTasks.push(task);
    processNextTask();
  });
}

function processNextTask() {
  // If concurrency is below the limit, pick the next in queue.
  while (activeTasks.length > 0 && currentConcurrency < MAX_CONCURRENCY) {
    const next = activeTasks.shift();
    next(); // Execute your fate!
  }
}

async function waitForToken() {
  // Wait until we have a token. Twiddle your thumbs or get coffee.
  while (tokenBucket <= 0) {
    await setTimeoutPromise(100); // poll every 100ms
  }
  tokenBucket--;
}

/**
 * If we get repeated 429 (too many requests), 
 * we'll cut concurrency in half like a grim measure of resource rationing.
 */
function handle429() {
  const now = Date.now();
  if (!ADAPTIVE_RATE) return;
  if (now - last429Timestamp < 30000) {
    // We do the concurrency guillotine here
    const old = MAX_CONCURRENCY;
    MAX_CONCURRENCY = Math.max(1, Math.floor(MAX_CONCURRENCY / 2));
    logWarning(`429 repeated => Reducing concurrency from ${old} to ${MAX_CONCURRENCY}`);
  }
  last429Timestamp = now;
}

/* -------------------------------------------
 * 5) IGDB SEARCH WRAPPERS
 * -------------------------------------------
 * Because raw queries are messy, we wrap them in our little helper functions.
 */
async function igdbRequest(query) {
  if (OFFLINE_MODE) {
    // In offline mode, our data well is dry. Return an empty array of sadness.
    return [];
  }

  const fn = async () => {
    while (true) {
      try {
        const response = await axios.post(
          'https://api.igdb.com/v4/games',
          query,
          {
            headers: {
              'Client-ID': CLIENT_ID,
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/json',
              'Content-Type': 'text/plain',
            },
          }
        );
        return response.data || [];
      } catch (error) {
        if (error.response) {
          if (error.response.status === 401) {
            logInfo(`Access token expired. Let's pray for a new one.`);
            accessToken = await getIGDBAccessToken();
            // Retry the request after renewal
            continue;
          }
          if (error.response.status === 429) {
            logWarning(`Received 429 (IGDB choking). We'll handle & retry...`);
            handle429();
            await setTimeoutPromise(2000); // short backoff
            continue;
          }
        }
        logError(`IGDB request error: ${error.message}`);
        return []; // Return nothing but a hollow heart.
      }
    }
  };

  return queueIGDBRequest(fn);
}

/**
 * Searching up to 50 results from IGDB. We can't handle all the world's games at once.
 */
async function igdbSearchRaw(searchString) {
  const query = `
    search "${searchString}";
    fields name, alternative_names.name, cover.*, genres.name, first_release_date,
           summary, storyline, platforms, involved_companies.company.name,
           involved_companies.publisher, involved_companies.developer,
           total_rating, total_rating_count, rating, rating_count,
           aggregated_rating, aggregated_rating_count, category, status,
           game_modes.name, keywords.name, age_ratings.*, collection.name,
           franchise.name, screenshots.image_id;
    limit 50;
  `;
  return igdbRequest(query);
}

/**
 * We'll pick the best fuzzy match from an array of IGDB results. 
 * If everything is below 0.4, we declare them all unworthy.
 */
function pickBestFuzzyMatch(baseGameTitle, igdbResults) {
  if (!igdbResults.length) return null;
  const allNames = [];

  igdbResults.forEach((game, idx) => {
    allNames.push({ name: game.name?.toLowerCase() || '', idx });
    (game.alternative_names || []).forEach((a) => {
      allNames.push({ name: a.name?.toLowerCase() || '', idx });
    });
  });

  const base = baseGameTitle.toLowerCase();
  const allTitles = allNames.map((x) => x.name);
  const bestMatchObj = stringSimilarity.findBestMatch(base, allTitles);
  if (bestMatchObj.bestMatch.rating < FUZZY_MATCH_THRESHOLD) {
    return null;
  }
  const bestMatchIndex = bestMatchObj.bestMatchIndex;
  const matchingIdx = allNames[bestMatchIndex].idx;
  return igdbResults[matchingIdx];
}

/**
 * Attempt an IGDB search for the given baseGameTitle, using some variations (like adding "amiga").
 * If we find a good match, we rejoice. If not, we weep silently.
 */
async function attemptIgdbSearch(baseGameTitle, searchTitle, platformId) {
  if (OFFLINE_MODE) {
    return null;
  }
  const results = await igdbSearchRaw(searchTitle);
  if (!results.length) return null;

  let platformMatches = [];
  if (platformId) {
    // Filter by platform ID to reduce false matches
    platformMatches = results.filter(
      (g) => g.platforms && g.platforms.includes(platformId)
    );
  }

  let best = pickBestFuzzyMatch(baseGameTitle, platformMatches);
  if (best) return best;

  best = pickBestFuzzyMatch(baseGameTitle, results);
  return best;
}

/* -------------------------------------------
 * 6) METADATA FETCH
 * -------------------------------------------
 * Actually fetch metadata from IGDB, if not offline. 
 * We do some heuristics to attempt the best possible match.
 */
async function fetchGameMetadata(baseGameTitle, consoleName) {
  if (OFFLINE_MODE) {
    return null; // We remain ignorant in offline mode.
  }
  const platformId = getPlatformId(consoleName);
  if (!platformId) {
    logWarning(
      `No platform ID found for console "${consoleName}". Skipping metadata for "${baseGameTitle}".`
    );
    return null;
  }

  // For Amiga, appending "amiga" to the search might help.
  const isAmiga = consoleName.toLowerCase().includes('amiga');
  const stepA = isAmiga ? `${baseGameTitle} amiga` : baseGameTitle;

  let metadata = await attemptIgdbSearch(baseGameTitle, stepA, platformId);
  if (metadata) return metadata;

  if (isAmiga) {
    // Retry without "amiga"
    metadata = await attemptIgdbSearch(baseGameTitle, baseGameTitle, platformId);
    if (metadata) return metadata;
  }

  // As a last-ditch effort, we try the first word, in case the rest was just noise.
  const firstWord = baseGameTitle.split(/\s+/)[0];
  if (firstWord && firstWord.length > 2) {
    metadata = await attemptIgdbSearch(baseGameTitle, firstWord, platformId);
    if (metadata) return metadata;
  }

  return null;
}

/* -------------------------------------------
 * 7) UTILS (DOWNLOADS, ETC.)
 * -------------------------------------------
 * Because we love stashing images, but we also love the option not to.
 */

/**
 * Download an image from the given URL to the specified filepath.
 * If it fails, the script's tears shall be your only consolation.
 */
async function downloadImage(url, filepath) {
  try {
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    const response = await axios.get(url, { responseType: 'stream' });
    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(filepath);
      response.data.pipe(writer);
      let error = null;
      writer.on('error', (err) => {
        error = err;
        writer.close();
        reject(err);
      });
      writer.on('close', () => {
        if (!error) resolve();
      });
    });
    return true;
  } catch (error) {
    logError(`Failed to download image from "${url}": ${error.message}`);
    return false;
  }
}

/**
 * Very naive approach to generating tags from multiple fields.
 * We'll basically create a swirling mess of tokens. 
 * At least they're alphabetical. 
 */
function generateTags({ summary, storyline, genres, developer }) {
  const tokens = [];
  if (summary) tokens.push(...summary.toLowerCase().split(/\W+/));
  if (storyline) tokens.push(...storyline.toLowerCase().split(/\W+/));
  if (genres && genres.length) {
    tokens.push(...genres.map((g) => g.name.toLowerCase()));
  }
  if (developer) tokens.push(...developer.toLowerCase().split(/\W+/));

  // remove short tokens or duplicates
  const filtered = new Set(tokens.filter((t) => t.length >= 4));
  return Array.from(filtered).sort();
}

/**
 * We store IGDB genres in a "NestedGenres" field, but IGDB doesn't give us parent data. 
 * So we just store each with a null parent. It's more for show than function.
 */
function processNestedGenres(igdbGenres) {
  if (!igdbGenres) return [];
  return igdbGenres.map((g) => {
    return {
      name: g.name,
      parent: null, // IGDB, why you no give us parent data?
    };
  });
}

/* -------------------------------------------
 * 8) FILE + DIR SCAN
 * -------------------------------------------
 * We attempt to discover all your ROMs, even if they're hidden like cryptic tombs.
 */
function collectGameEntries() {
  const gameEntries = [];

  function scanDirectoryForGames(dirPath, consoleName) {
    let entries;
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch (err) {
      logError(`Failed to read directory "${dirPath}": ${err.message}`);
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        scanDirectoryForGames(fullPath, consoleName);
      } else {
        const ext = path.extname(entry.name);
        if (!isValidRomExtension(ext)) continue; // We only love valid ROMs
        const baseName = getBaseGameName(entry.name);
        gameEntries.push({
          title: baseName,
          consoleName,
          romPath: fullPath,
        });
      }
    }
  }

  /**
   * Recursively look for subfolders in the base ROM path. 
   * If a folder has files, we treat that folder name as a console name 
   * (like "NES," "SNES," or "Dark Pit of Mystery").
   */
  function recursiveSystemScan(folderPath, relativePathParts) {
    let subEntries;
    try {
      subEntries = fs.readdirSync(folderPath, { withFileTypes: true });
    } catch (err) {
      logError(`Failed to read directory "${folderPath}": ${err.message}`);
      return;
    }

    for (const se of subEntries) {
      if (se.isDirectory()) {
        const newRel = relativePathParts.concat(se.name);
        recursiveSystemScan(path.join(folderPath, se.name), newRel);
      }
    }

    const hasFiles = subEntries.some((e) => !e.isDirectory());
    if (hasFiles) {
      const consoleName = relativePathParts.join(' / ').trim();
      scanDirectoryForGames(folderPath, consoleName);
    }
  }

  recursiveSystemScan(BASE_ROMS_PATH, []);
  return gameEntries;
}

/* -------------------------------------------
 * 9) LOADING EXISTING GAMES (PER-CONSOLE JSON)
 * -------------------------------------------
 * Because we don't want to rewrite all your data from scratch 
 * every time you run this script (unless you're a sadist).
 */
function loadExistingGames() {
  // We'll load all .json files in OUTPUT_FOLDER except unmatched.json and consoles_index.json.
  const finalMap = {};

  if (!fs.existsSync(OUTPUT_FOLDER)) {
    fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });
  }

  const dirEntries = fs.readdirSync(OUTPUT_FOLDER, { withFileTypes: true });
  for (const entry of dirEntries) {
    const lower = entry.name.toLowerCase();
    if (!lower.endsWith('.json')) continue;
    if (lower === 'unmatched.json' || lower === 'consoles_index.json') continue;

    const fullPath = path.join(OUTPUT_FOLDER, entry.name);
    let data = null;
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      data = JSON.parse(content);
    } catch (err) {
      logWarning(`Unable to parse ${entry.name}: ${err.message}`);
      continue;
    }
    const gamesArray = data.Games || [];

    for (const g of gamesArray) {
      // Key = "console:title"
      const key = (g.Console.toLowerCase().trim() + ':' + g.Title.toLowerCase().trim());
      finalMap[key] = g;
    }
  }

  return finalMap;
}

/* -------------------------------------------
 * 10) SAVING DATA (PER-CONSOLE JSON + INDEX)
 * -------------------------------------------
 * Because after all our toil, we want to persist the results 
 * so they don't vanish into oblivion.
 */
function validateJsonSchema(games) {
  const schema = {
    type: 'object',
    properties: {
      Games: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            Title: { type: 'string' },
            Console: { type: 'string' },
            PlatformID: { type: 'number' },
            IGDB_ID: { type: 'number' },
            Genre: { type: 'string' },
            RomPaths: {
              type: 'array',
              items: { type: 'string' },
            },
            CorePath: { type: 'string' },
            Description: { type: 'string' },
            Players: { type: 'number' },
            Rating: { type: 'string' },
            ReleaseDate: { type: 'string' },
            ReleaseYear: { type: 'string' },
            Developer: { type: 'string' },
            Publisher: { type: 'string' },
            Keywords: { type: 'string' },
            AgeRatings: { type: 'string' },
            Collection: { type: 'string' },
            Franchise: { type: 'string' },
            Screenshots: {
              type: 'array',
              items: { type: 'string' },
            },
            Region: { type: 'string' },
            Language: { type: 'string' },
            FileSize: { type: 'number' },
            PlayCount: { type: 'number' },
            PlayTime: { type: 'number' },
            LastPlayed: { type: 'string' },
            ControllerType: { type: 'string' },
            SupportWebsite: { type: 'string' },
            CoverImage: { type: 'string' },
            BackgroundImage: { type: 'string' },
            HeaderImage: { type: 'string' },
            SaveFileLocation: { type: 'string' },
            CheatsAvailable: { type: 'boolean' },
            Achievements: { type: 'string' },
            YouTubeTrailer: { type: 'string' },
            SoundtrackLink: { type: 'string' },
            LaunchArguments: { type: 'string' },
            VRSupport: { type: 'boolean' },
            Notes: { type: 'string' },
            ControlScheme: { type: 'string' },
            DiskCount: { type: 'number' },
            AdditionalNotes: { type: 'string' },
            MetadataFetched: { type: 'boolean' },

            // Additional new fields from the darkest corners of IGDB
            Storyline: { type: 'string' },
            Category: { type: 'string' },
            Status: { type: 'string' },
            NestedGenres: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  parent: { type: ['string', 'null'] },
                },
                required: ['name', 'parent'],
              },
            },
            TagList: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['Title', 'Console', 'RomPaths'],
        },
      },
    },
    required: ['Games'],
  };

  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(schema);
  const valid = validate({ Games: games });
  if (!valid) {
    logWarning(`Schema validation failed: ${JSON.stringify(validate.errors, null, 2)}`);
  } else {
    logSuccess(`Schema validation passed. Rejoice, your JSON is (probably) well-formed!`);
  }
}

/**
 * We take the finalMap (key = console:title => game), plus unmatched array,
 * then write out per-console JSON + unmatched + console index.
 */
async function saveCurrentData(finalMap, unmatchedGames) {
  // Group by console
  const byConsole = {};
  for (const key of Object.keys(finalMap)) {
    const gameObj = finalMap[key];
    const cName = gameObj.Console;
    if (!byConsole[cName]) {
      byConsole[cName] = [];
    }
    byConsole[cName].push(gameObj);
  }

  // Sort each console's array + optionally validate
  for (const consoleName of Object.keys(byConsole)) {
    byConsole[consoleName].sort((a, b) => a.Title.localeCompare(b.Title));

    if (VALIDATE_SCHEMA) {
      validateJsonSchema(byConsole[consoleName]);
    }

    // Save per console
    const fileName = sanitizeForFileName(consoleName) + '.json';
    const outPath = path.join(OUTPUT_FOLDER, fileName);
    const toSave = { Games: byConsole[consoleName] };
    fs.writeFileSync(outPath, JSON.stringify(toSave, null, 2), 'utf8');
    logSuccess(`Wrote ${byConsole[consoleName].length} games to "${outPath}". They are now immortal (sort of).`);
  }

  // Write unmatched
  fs.writeFileSync(
    UNMATCHED_JSON_PATH,
    JSON.stringify(unmatchedGames, null, 2),
    'utf8'
  );
  logSuccess(`Wrote ${unmatchedGames.length} unmatched entries to "${UNMATCHED_JSON_PATH}". They remain unloved.`);

  // Write console index
  const consoleIndex = Object.keys(byConsole).map((consoleName) => {
    const fileName = sanitizeForFileName(consoleName) + '.json';
    return {
      console: consoleName,
      file: fileName,
      count: byConsole[consoleName].length,
    };
  });

  const indexObj = { consoles: consoleIndex };
  fs.writeFileSync(
    CONSOLE_INDEX_PATH,
    JSON.stringify(indexObj, null, 2),
    'utf8'
  );
  logSuccess(`Wrote consoles index to "${CONSOLE_INDEX_PATH}". The circle of life is complete.`);
}

/* -------------------------------------------
 * MAIN LOGIC
 * -------------------------------------------
 * This is where it all comes together in a majestic mess of concurrency, queries, 
 * and the sweet smell of success or heartbreak.
 */

async function buildGameLibrary() {
  // Load existing data
  const existingMap = loadExistingGames();

  // Collect new entries from ROM folders
  const newGameEntries = collectGameEntries();
  if (newGameEntries.length === 0) {
    logWarning('No games found in the ROMs directory. Are you sure you have actual games?');
    return { finalMap: existingMap, unmatchedGames: [] };
  }

  // Initialize IGDB if we're not self-isolating offline
  await initIGDB();

  // We'll merge everything into one big map: key = "console:baseTitle"
  const finalMap = { ...existingMap };

  // For logging progress, we use a CLI progress bar so we can pretend we're building something heroic.
  const progressBar = new cliProgress.SingleBar({
    format: '{bar} {percentage}% | {value}/{total} | {gameTitle} | {metadataStatus}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
  });
  progressBar.start(newGameEntries.length, 0, {
    gameTitle: '',
    metadataStatus: '',
  });

  const unmatchedGames = [];

  let processedCount = 0;
  let processedSinceLastSave = 0;

  for (let i = 0; i < newGameEntries.length; i++) {
    const { title: baseName, consoleName, romPath } = newGameEntries[i];
    const key = consoleName.toLowerCase().trim() + ':' + baseName.toLowerCase().trim();

    progressBar.update(i, { gameTitle: baseName, metadataStatus: '' });

    // Gather file size in a desperate attempt to see how heavy the game is.
    let romFileSize = 0;
    try {
      romFileSize = fs.statSync(romPath).size;
    } catch (err) {
      logError(`Failed to get file size for ROM "${romPath}": ${err.message}`);
    }

    let existing = finalMap[key];

    if (!existing) {
      // A new game has arrived, brand-new, wide-eyed, uncertain of its fate.
      let metadata = null;
      let didFetchMetadata = false;
      if (!OFFLINE_MODE) {
        metadata = await fetchGameMetadata(normalizeTitle(baseName), consoleName);
        didFetchMetadata = !!metadata;
      }

      if (metadata) {
        progressBar.update(i, { metadataStatus: chalk.green('Found') });
        logSuccess(`Metadata found for "${baseName}" on "${consoleName}"!`);
      } else if (!OFFLINE_MODE) {
        progressBar.update(i, { metadataStatus: chalk.red('Not Found') });
        logWarning(`No metadata found for "${baseName}" on "${consoleName}". It's doomed to remain an enigma.`);
        unmatchedGames.push({ title: baseName, console: consoleName, romPath });
      } else {
        // Offline => we didn't search
        progressBar.update(i, { metadataStatus: chalk.yellow('Offline Skip') });
      }

      const platformId = getPlatformId(consoleName) || 0;
      let releaseDateStr = '';
      let releaseYear = '';
      if (metadata?.first_release_date) {
        const dt = new Date(metadata.first_release_date * 1000);
        releaseDateStr = dt.toISOString().split('T')[0];
        releaseYear = dt.getFullYear().toString();
      }

      // Additional IGDB fields
      const storyline = metadata?.storyline || '';
      const category = metadata?.category !== undefined ? String(metadata.category) : '';
      const status = metadata?.status !== undefined ? String(metadata.status) : '';

      // nested genres
      const nestedGenres = processNestedGenres(metadata?.genres);

      // generate tags (like turning random words into a questionable SEO scheme).
      let tagList = [];
      if (TAG_GENERATION && metadata) {
        tagList = generateTags({
          summary: metadata.summary,
          storyline,
          genres: metadata.genres || [],
          developer: metadata?.involved_companies
            ? getCompanies(metadata.involved_companies, 'developer')
            : '',
        });
      }

      existing = {
        Title: baseName,
        Console: consoleName,
        PlatformID: platformId,
        IGDB_ID: metadata?.id || 0,
        Genre: metadata?.genres
          ? metadata.genres.map((g) => g.name).join(', ')
          : 'Unknown',
        RomPaths: [romPath],
        CorePath: getCorePath(consoleName),
        Description: metadata?.summary || '',
        Players: metadata?.game_modes ? getPlayerCount(metadata.game_modes) : 1,
        Rating: metadata?.rating ? (metadata.rating / 10).toFixed(1) : '',
        ReleaseDate: releaseDateStr,
        ReleaseYear: releaseYear,
        Developer: metadata?.involved_companies
          ? getCompanies(metadata.involved_companies, 'developer')
          : '',
        Publisher: metadata?.involved_companies
          ? getCompanies(metadata.involved_companies, 'publisher')
          : '',
        Keywords: metadata?.keywords
          ? metadata.keywords.map((k) => k.name).join(', ')
          : '',
        AgeRatings: metadata?.age_ratings
          ? getAgeRatings(metadata.age_ratings)
          : '',
        Collection: metadata?.collection?.name || '',
        Franchise: metadata?.franchise?.name || '',
        Screenshots: [],
        Region: '',
        Language: '',
        FileSize: romFileSize,
        PlayCount: 0,
        PlayTime: 0,
        LastPlayed: '',
        ControllerType: 'Gamepad',
        SupportWebsite: '',
        CoverImage: '',
        BackgroundImage: '',
        HeaderImage: '',
        SaveFileLocation: '',
        CheatsAvailable: false,
        Achievements: '',
        YouTubeTrailer: '',
        SoundtrackLink: '',
        LaunchArguments: '',
        VRSupport: false,
        Notes: '',
        ControlScheme: '',
        DiskCount: 1,
        AdditionalNotes: '',
        MetadataFetched: didFetchMetadata,

        // new fields
        Storyline: storyline,
        Category: category,
        Status: status,
        NestedGenres: nestedGenres,
        TagList: tagList,
      };

      // If not lazy, attempt to download covers & screenshots
      if (metadata && !LAZY_DOWNLOAD) {
        if (metadata.cover?.image_id) {
          const coverUrl = `https://images.igdb.com/igdb/image/upload/t_cover_big/${metadata.cover.image_id}.jpg`;
          const coverAbs = getCoverImageAbsolutePath(consoleName, baseName);
          const success = await downloadImage(coverUrl, coverAbs);
          if (success) {
            existing.CoverImage = getCoverImageShortPath(consoleName, baseName);
          }
        }
        if (metadata?.screenshots?.length) {
          const maxScreens = metadata.screenshots.slice(0, 3);
          for (let j = 0; j < maxScreens.length; j++) {
            const imageId = maxScreens[j].image_id;
            const screenshotUrl = `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${imageId}.jpg`;
            const screenshotAbs = getScreenshotAbsolutePath(consoleName, baseName, j + 1);
            const success = await downloadImage(screenshotUrl, screenshotAbs);
            if (success) {
              existing.Screenshots.push(
                getScreenshotShortPath(consoleName, baseName, j + 1)
              );
            }
          }
        }
      } else if (metadata && LAZY_DOWNLOAD) {
        // Lazy approach = store image URLs only
        if (metadata.cover?.image_id) {
          existing.CoverImage = `https://images.igdb.com/igdb/image/upload/t_cover_big/${metadata.cover.image_id}.jpg`;
        }
        if (metadata?.screenshots?.length) {
          const maxScreens = metadata.screenshots.slice(0, 3);
          for (let j = 0; j < maxScreens.length; j++) {
            const imageId = maxScreens[j].image_id;
            const screenshotUrl = `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${imageId}.jpg`;
            existing.Screenshots.push(screenshotUrl);
          }
        }
      }

      finalMap[key] = existing;
    } else {
      // Game already exists in finalMap; let's just add another ROM path if it's new.
      if (!existing.RomPaths.includes(romPath)) {
        existing.RomPaths.push(romPath);
      }

      // Accumulate file size so we can see how bloated your library is.
      existing.FileSize = (existing.FileSize || 0) + romFileSize;

      // Check if we skip existing or refresh metadata
      if ((SKIP_EXISTING_METADATA || existing.MetadataFetched) && !OFFLINE_MODE) {
        progressBar.update(i, { metadataStatus: chalk.yellow('Skipped') });
      } else if (OFFLINE_MODE) {
        progressBar.update(i, { metadataStatus: chalk.yellow('Offline') });
      } else {
        // Attempt to refresh from IGDB
        const metadata = await fetchGameMetadata(normalizeTitle(baseName), consoleName);
        if (metadata) {
          progressBar.update(i, { metadataStatus: chalk.green('Refreshed') });
          logSuccess(`Refreshed metadata for "${baseName}" on "${consoleName}". Feel the knowledge surge!`);
          existing.MetadataFetched = true;

          existing.IGDB_ID = metadata.id || existing.IGDB_ID;
          existing.Description = metadata.summary || existing.Description;
          existing.Storyline = metadata.storyline || existing.Storyline || '';
          existing.Category =
            metadata.category !== undefined
              ? String(metadata.category)
              : existing.Category || '';
          existing.Status =
            metadata.status !== undefined
              ? String(metadata.status)
              : existing.Status || '';

          if (metadata.game_modes) {
            existing.Players = getPlayerCount(metadata.game_modes);
          }
          if (metadata.rating) {
            existing.Rating = (metadata.rating / 10).toFixed(1);
          }
          if (metadata.first_release_date) {
            const dt = new Date(metadata.first_release_date * 1000);
            existing.ReleaseDate = dt.toISOString().split('T')[0];
            existing.ReleaseYear = dt.getFullYear().toString();
          }
          if (metadata.involved_companies) {
            existing.Developer = getCompanies(metadata.involved_companies, 'developer');
            existing.Publisher = getCompanies(metadata.involved_companies, 'publisher');
          }
          if (metadata.keywords) {
            existing.Keywords = metadata.keywords.map((k) => k.name).join(', ');
          }
          if (metadata.age_ratings) {
            existing.AgeRatings = getAgeRatings(metadata.age_ratings);
          }
          if (metadata.collection) {
            existing.Collection = metadata.collection.name;
          }
          if (metadata.franchise) {
            existing.Franchise = metadata.franchise.name;
          }
          if (metadata.genres) {
            existing.Genre = metadata.genres.map((g) => g.name).join(', ');
            existing.NestedGenres = processNestedGenres(metadata.genres);
          }

          // Tag generation
          if (TAG_GENERATION) {
            const newTags = generateTags({
              summary: metadata.summary,
              storyline: metadata.storyline,
              genres: metadata.genres || [],
              developer: existing.Developer,
            });
            if (!existing.TagList) existing.TagList = [];
            const combinedSet = new Set([...existing.TagList, ...newTags]);
            existing.TagList = Array.from(combinedSet).sort();
          }

          // Re-download cover if missing & not lazy
          if (!LAZY_DOWNLOAD) {
            if (!existing.CoverImage && metadata.cover?.image_id) {
              const coverAbs = getCoverImageAbsolutePath(consoleName, baseName);
              if (!fs.existsSync(coverAbs)) {
                const coverUrl = `https://images.igdb.com/igdb/image/upload/t_cover_big/${metadata.cover.image_id}.jpg`;
                const success = await downloadImage(coverUrl, coverAbs);
                if (success) {
                  existing.CoverImage = getCoverImageShortPath(consoleName, baseName);
                }
              }
            }
            // Re-download screenshots if none exist
            if ((!existing.Screenshots || existing.Screenshots.length === 0) && metadata.screenshots) {
              const newShots = [];
              const maxScreens = metadata.screenshots.slice(0, 3);
              for (let j = 0; j < maxScreens.length; j++) {
                const imageId = maxScreens[j].image_id;
                const screenshotAbs = getScreenshotAbsolutePath(consoleName, baseName, j + 1);
                if (!fs.existsSync(screenshotAbs)) {
                  const screenshotUrl = `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${imageId}.jpg`;
                  const success = await downloadImage(screenshotUrl, screenshotAbs);
                  if (success) {
                    newShots.push(getScreenshotShortPath(consoleName, baseName, j + 1));
                  }
                }
              }
              existing.Screenshots = newShots;
            }
          } else {
            // LAZY download approach
            if (!existing.CoverImage && metadata.cover?.image_id) {
              existing.CoverImage = `https://images.igdb.com/igdb/image/upload/t_cover_big/${metadata.cover.image_id}.jpg`;
            }
            if ((!existing.Screenshots || existing.Screenshots.length === 0) && metadata.screenshots) {
              const maxScreens = metadata.screenshots.slice(0, 3);
              existing.Screenshots = maxScreens.map(
                (sc) => `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${sc.image_id}.jpg`
              );
            }
          }
        } else {
          progressBar.update(i, { metadataStatus: chalk.red('No New') });
          unmatchedGames.push({ title: baseName, console: consoleName, romPath });
        }
      }
    }

    // Check for disk pattern, e.g. (Disk 1 of 2). Because multi-disk madness is real.
    const diskMatch = romPath.match(/\(Disk\s*(\d+)\s*of\s*(\d+)\)/i);
    if (diskMatch) {
      const totalDisks = parseInt(diskMatch[2], 10);
      if (totalDisks > (finalMap[key].DiskCount || 1)) {
        finalMap[key].DiskCount = totalDisks;
      }
    }

    processedCount++;
    processedSinceLastSave++;

    // Partial save every N entries, in case a meteor hits your PC mid-run.
    if (processedSinceLastSave >= SAVE_EVERY_N) {
      await saveCurrentData(finalMap, unmatchedGames);
      processedSinceLastSave = 0;
    }
  }

  progressBar.stop();
  return { finalMap, unmatchedGames };
}

/* -------------------------------------------
 * 11) MAIN + SIGNAL
 * -------------------------------------------
 * We gather up everything, run buildGameLibrary, and then do a final save.
 */

let scriptInProgress = true;
let finalMapGlobal = null;
let unmatchedGlobal = null;

async function main() {
  process.on('SIGINT', async () => {
    // If user hits Ctrl+C, we at least want to salvage whatever we've done so far.
    if (scriptInProgress) {
      logWarning('Caught SIGINT, saving partial progress to avoid total meltdown...');
      if (finalMapGlobal && unmatchedGlobal) {
        await saveCurrentData(finalMapGlobal, unmatchedGlobal);
      }
      process.exit(1);
    } else {
      process.exit(0);
    }
  });

  // Ensure base ROMs path exists
  if (!fs.existsSync(BASE_ROMS_PATH)) {
    logError(`Base ROMs path "${BASE_ROMS_PATH}" does not exist. Abandon all hope.`);
    process.exit(1);
  }
  // Ensure output folders exist
  fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });
  fs.mkdirSync(IMAGES_PATH, { recursive: true });

  // Check for missing cores
  Object.entries(CORE_MAP).forEach(([consoleKey, corePath]) => {
    if (!fs.existsSync(corePath)) {
      logWarning(`Core for "${consoleKey}" not found at "${corePath}". This console shall remain an orphan...`);
    }
  });

  const { finalMap, unmatchedGames } = await buildGameLibrary();
  finalMapGlobal = finalMap;
  unmatchedGlobal = unmatchedGames;

  // Final save
  await saveCurrentData(finalMap, unmatchedGames);
  scriptInProgress = false;

  const totalGames = Object.keys(finalMap).length;
  logSuccess(`Done! Processed ${totalGames} total games. Go forth and game!`);
}

main();
