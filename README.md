# buildGamesJson

If you’ve ever dreamed of rummaging through your sprawling ROM collection like a **raccoon** searching for last night’s leftover pizza—only to meticulously catalog everything in neat JSON scrapbooks—then **buildGamesJson** is your new best friend. This Node.js script scans through your ROM folders, fetches game metadata from IGDB (unless you prefer sweet ignorance in Offline Mode), and saves it all into per-console JSON files with optional schema validation. Yes, it’s basically the librarian of your retro gaming crypt.

## Features

- **Parallel Requests with Concurrency**  
  Summon a worker pool (default 2 workers) to query IGDB in parallel, so you don’t do it one by one like a medieval scribe.

- **Rate-Limiting**  
  We cunningly refuse to surpass 4 requests/second using a token-bucket approach (so IGDB’s banhammer doesn’t descend upon us).

- **Adaptive Rate**  
  Like a startled cat, if we get repeated 429 (Too Many Requests), we cut concurrency in half. The script’s version of survival instincts.

- **Offline Mode**  
  If you’d rather remain in the dark, or the IGDB gods have forsaken you, run offline: no metadata fetching, zero regrets.

- **Lazy Asset Download**  
  Store only URLs for covers/screenshots. Save disk space for your favorite cat memes.

- **Expanded IGDB Fields**  
  We pull in goodies like `storyline`, `category`, `status`, `game_modes`, `keywords`, etc., then store them like prized collectibles.

- **Genre Hierarchies**  
  `NestedGenres` holds each genre with a (currently empty) `parent`. (IGDB doesn’t provide real hierarchy, but hey, we tried.)

- **Auto Tag Generation**  
  We generate naive tags from summary, storyline, genres, and developer text. Perfect for unleashing **questionable** SEO-like mania.

- **JSON Schema Validation**  
  An optional JSON schema (powered by [ajv](https://www.npmjs.com/package/ajv)) ensures your final JSON meets your lofty standards.

- **Partial Saves**  
  We save progress every 20 processed entries, so if your computer spontaneously combusts, at least some data survives the flames.

- **Unmatched Titles**  
  We track games that IGDB simply can’t find in a special `unmatched.json`. (Probably obscure bootlegs or an actual virus disguised as a ROM.)

- **Console Index**  
  `consoles_index.json` references your per-console JSON files, letting you see your entire empire of retro consoles at a glance.

## Installation & Setup

1. **Install Node.js**  
   Make sure you have Node.js (≥14.0) installed, so the script can do its conjuring.

2. **Clone this repo**  
   ```bash
   git clone https://github.com/Nickfc/ElectronKiosk/buildGamesJson.git
   cd buildGamesJson
   ```

3. **Install Dependencies**  
   ```bash
   npm install
   ```
   We rely on:
   - **axios** for HTTP requests
   - **chalk** for colorful console logs
   - **cli-progress** for fancy progress bars
   - **string-similarity** for fuzzy title matching
   - **ini** for reading the sacred `config.ini`
   - **ajv** for optional JSON schema validation

4. **Create/Configure `config.ini`**  
   Place a `config.ini` in the same directory (unless you enjoy errors).  
   Example:
   ```ini
   [Paths]
   RomsPath = C:/RetroArch/Games/Roms
   OutputFolder = data
   ImagesFolder = data/images
   CoresFolder = C:/RetroArch/win64/cores

   [IGDB]
   ClientID = YOUR_CLIENT_ID
   ClientSecret = YOUR_CLIENT_SECRET

   [Settings]
   Concurrency = 4
   SkipExistingMetadata = false
   OfflineMode = false
   LazyDownload = false
   AdaptiveRate = true
   ValidateSchema = true
   TagGeneration = true
   ```

   - **`RomsPath`**: Root directory containing all your ROM subfolders.  
   - **`ImagesFolder`**: Where the script stores downloaded covers and screenshots.  
   - **`ClientID` / `ClientSecret`**: Keys for IGDB API. If left empty, the script can't do magical metadata.  
   - **`Concurrency`**: Number of parallel requests.  
   - **`OfflineMode`**: If `true`, no IGDB requests.  
   - **`LazyDownload`**: If `true`, only store URLs for images—no local downloads.  
   - **`AdaptiveRate`**: If 429 errors repeat, concurrency is halved to keep IGDB happy.  
   - **`ValidateSchema`**: Validate final JSON using ajv.  
   - **`TagGeneration`**: Generate naive tags from summary, storyline, etc.  

## Usage

Just run the script:

```bash
node buildGamesJson.js
```

### What It Does

1. **Scans** your `RomsPath` for any recognized ROM files (by extension).  
2. **Groups** them by console folder (subdirectories = consoles).  
3. **Fetches** (or attempts to fetch) metadata from IGDB:  
   - Title, summary, release date, rating, developer, publisher, keywords, you name it.  
4. **Downloads** covers & screenshots (unless you’re lazy, in which case it stores URLs).  
5. **Dumps** each console’s library in its own `<console_name>.json` inside `OutputFolder`.  
6. **Writes** an overall `consoles_index.json` referencing them all.  
7. **Logs** any ROMs it can’t find in IGDB to `unmatched.json`.  

### Sample Output Structure

```
data/
 ├─ NES.json
 ├─ SNES.json
 ├─ unmatched.json
 └─ consoles_index.json
images/
 ├─ NES/
 │   └─ Super Mario Bros/
 │       ├─ cover.jpg
 │       └─ screenshots/
 │           └─ 1.jpg
 └─ SNES/
     └─ ...
```

> Note: If `LazyDownload` is true, you won’t see cover.jpg or screenshots locally. Instead, you’ll have an array of IGDB image URLs in your JSON.

## Schema Validation

If `ValidateSchema` is true, the script runs everything through AJV to check it’s not producing nonsense (e.g., a game with zero `RomPaths`). If validation fails, we warn you but keep your data. We’re not total monsters.

## Partial Saving

After every 20 new/updated entries, the script writes out your current progress. So if you do something crazy like forcibly shutting down your PC, you’ll at least have some data left to pick through in the rubble.

## Concurrency & Rate-Limiting

- **Concurrency**: By default 2, but can be set in `config.ini`. More concurrency = faster queries... until IGDB complains.  
- **4 requests/second** limit: We’re polite. A token-bucket ensures we won’t exceed 4 requests per second.  
- **Adaptive meltdown**: A fancy way of saying we reduce concurrency by half if we keep hitting 429 errors.

## Offline Mode

If you’re offline—or maybe you just want to remain in the bliss of ignorance—turn `OfflineMode` on. The script will skip IGDB entirely. You’ll still get a JSON listing of your ROMs, but metadata will be mostly empty. Perfect for doomsday scenarios.

## Unmatched Games

Any ROM that IGDB can’t identify (or that fails fuzzy matching) lands in the `unmatched.json` file. Maybe you have a super-rare beta or a mislabeled folder from your basement. Keep it safe or rename it properly so it doesn’t get left behind next time.

## Troubleshooting

1. **Missing IGDB Credentials**  
   - You’ll get an error if `ClientID`/`ClientSecret` are missing and you’re not in offline mode.  
2. **Bizarre File Extensions**  
   - Only certain ROM extensions are recognized. See the top of `buildGamesJson.js` to add your own if you’re feeling rebellious.  
3. **Missing Cores**  
   - The script tries to map each console to a specific core path. If you don’t have that, it’ll emit a warning. Update `CORE_MAP` if you want a different path or no path at all.  

## Contributing

PRs are welcome. If you have new ideas—like summoning more metadata from IGDB or generating even wackier tags—go for it. Just keep the code at least half as sarcastic, so we maintain brand consistency.

## License

[MIT](./LICENSE) — basically do whatever you want, at your own risk, and don’t blame us if the script accidentally triggers the apocalypse.  

---

**Enjoy your newly organized retro library**—complete with random tags, partial downloads, and fuzzy matched titles. Because the line between collecting and obsessing is oh-so-thin!  
