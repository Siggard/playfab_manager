# Changelog

## [1.2.0] - 2026-08-23

Game design dropped staff cards and added personal connections.

### Added

#### Club Bundle Sub-header
- **TEAM row** - The single team of a club now sits in a compact sub-header row instead of a full item group
  - Click the chip to open the team editor; shows power, level and balance inline
  - **Change** opens a single-select picker (radio buttons, shows teams already used by other clubs)
  - **Remove** detaches the team from the bundle
  - Adding a team to a club that already has one replaces it, whichever way it is added (drag, double-click, picker)
- **STAFF row** - Staff counters read from and written to the bundle's own `CustomData.staff`
  - One `-/+` stepper plus a number field per role, with a running total
  - Roles come from the bundle template's `customData.staff` (Settings -> Templates), plus any extra key already present in the bundle JSON
- **REP row** - Club reputation edited inline, in the same visual language as the staff steppers
  - `value` is the signed position on the scale, `face` is which side of the token is up; the two are independent, so a positive face can sit at -10
  - The stepper walks -10…+10 and skips 0, never touching the face; the face toggle changes the side by hand, never touching the value
  - Stored unchanged as `CustomData.reputation = { value, face }`; an existing `value: 0` is displayed as-is rather than migrated
- **INFRA row** - Rebuilt for the new slot-based infrastructure format
  - All six slots always shown, colored by state: `locked` / `closed` / `negotiating` / `deploying` / `active`
  - An occupied slot shows its `location_id` (click opens the card) and level; a `timer` shows when set
  - A `location_id` with no matching entity is flagged red — currently `pitch` and `boot_room` in every club
  - Location cards in the bundle that no slot points at are listed as "not in any slot"
  - Slots and location cards stay in step: adding a location card takes the first free unlocked slot (`active`, level 1), removing it resets that slot to `closed`. Existing data is never rewritten on load — only your edits move slots.
- **`personal_connection`** entity class ("Личные связи") - name, description and free-form JSON
  - Own icon/color, ID pattern `personal_connection_N`, item template, and a bundle group of its own
  - Description is rendered on the card, like feature tactics
- **Rename an ItemId** - The ID field on an existing entity is still read-only, but a **Rename** button next to it opens a panel that previews every reference that will be rewritten, then rewrites them in one pass
  - Blocks empty IDs, duplicates and whitespace; warns (without blocking) when the new ID does not match the class prefix
  - Notes when the entity has no explicit `imagePath`, since an image resolved by the old ID convention will need re-linking
- **Club bundle card summary** - Reputation chip in the header stats (signed value plus the raised side, colored by face), and the footer counts rebuilt for the current schema
  - Players, tactics and connections still come from the cards, but staff is now the total of `CustomData.staff` (roles in the tooltip) and locations became filled infrastructure slots as `used/total`
  - Team count dropped in favour of a red "none" chip when a club has no team at all
  - Flags slots pointing at an ID with no entity behind it, and location cards that no slot points at
- **Settings -> Data -> Legacy Cleanup** - Counts leftover `staff` / `feature_staff` entities in the loaded catalog and deletes them (also unlinking them from any bundle) after a confirmation

### Removed
- **`staff` and `feature_staff` entity classes** - Gone from the class dropdown, item templates, bundle groups, icons and colors
  - Entities of these classes already in a catalog stay visible (as generic cards) so they can be found and removed
  - Staff item template and any `staff` bundle requirement are pruned from saved settings on load
- **Staff-derived UI** - Active marks badge, linked-tactics badge, the salary total in group headers, and the "linked items" mechanism they fed

### Fixed
- **Reference scanning missed the newer data shapes** - "Assigned To" only knew about `BundledItems`, `feature_ids`, tactic slots and `debuff_ids`, so `infrastructure.slots[].location_id` and `team_roster` references were invisible. Reference lookup now walks CustomData generically and matches IDs wherever they sit, as values or as object keys, reporting the exact path of each hit.
- **Empty Entity Pool in bundle focus view** - Non-bundle items were matched with `Bundle === null`, but a PlayFab Pull omits the `Bundle` field entirely, leaving the pool and every quick-add list empty. Now matched on the absence of `BundledItems`.

### Changed
- Club bundle recommendations: `staff: 1-2` replaced by `personal_connection: optional`
- New clubs start with `staff` counters, a `reputation` block, and six empty infrastructure slots in `CustomData`
- Dropped the old `infrastructure.{training_base,academy,main_office,stadium}` shape from templates and rendering; no club in the catalog still uses it
- Settings schema version bumped to 1.2.0

---

## [1.1.2] - 2026-01-19

### Added

#### EntityCard Enhancements
- **Power/PowerLimit display** - Shows power as "X/Y" format (e.g., "⚡3/5")
- **Staff active marks** - Shows active marks from marks array (e.g., "fitness/tactics")
- **Staff level with max** - Shows level as "Lv X/Y" when max_level exists
- **Location directions** - Direction tags (ATT, DEF, MID, GK) displayed as colored chips
- **Location upgradeable** - Arrow icon indicating if location can be upgraded
- **Location action duration** - Clock icon with duration in weeks (e.g., "🕐2w")
- **Location requirements** - Compact display of activation requirements
  - Format: `[*]mark` (non-strict) / `[!]mark` (strict)
  - Groups joined with `+`, variants joined with `//`
  - Duplicate groups collapsed with `×N`
- **Location bonus marks** - Shows bonus marks granted (e.g., "+fitness +tactics×2")

#### EntityEditor Improvements
- **Linked Features** - Players show linked feature IDs from position fields as clickable EntityCards
- **Help Panel** - Expandable side panel with requirements format documentation
  - "?" button next to Custom Data field
  - Detailed explanation with numbered examples
- **Field reordering** - Reorganized fields: ID/Class → DisplayName → Description → CustomData → Linked Features → Image → Tags

#### BundleFocusView Improvements
- **Infrastructure display** - Shows training_base, academy, main_office, stadium levels in header
- **Clickable modules** - Module IDs in infrastructure are clickable to open entity editor
- **Configurable recommendations** - Recommendations now read from bundle template settings

### Changed

#### Group Order and Labels
- Changed group order to: Team, Players, Tactics, Staff, Locations
- Renamed "Teams" to "Team" (singular)
- Team group collapsed by default

#### Quick Add Modal
- Now uses EntityCard component for consistent styling

#### Settings Templates
- `itemRequirements` now uses `{ min, max, label }` format for recommendations
- Export/Import settings available for sharing configurations between users

### Removed
- **Virtual Currencies** - Removed from BundleEditor, SettingsModal, and BundleCreator

### Fixed
- **Location ID validation** - Pattern now allows letters and underscores (e.g., "loc_gym", "loc_training_1")
  - Changed from `/^loc_\d+$/` to `/^loc_[a-z0-9_]+$/i`

### Technical
- Added `formatRequirements()`, `formatBonusMarks()` helpers in entityHelpers.js
- Added `linkedFeatures` computed property in EntityEditor for player feature extraction
- Added modal expansion pattern for help panel (`.modal-container.with-help`)

---

## [1.1.1] - 2026-01-18

### Added

#### Bundle Focus Mode
- **Focus View** - Dedicated view for editing a single bundle
- **Grouped Items** - Bundle contents organized by ItemClass (Teams, Players, Staff, etc.)
- **Recommendations** - Shows recommended item counts per group (e.g., "5-7 players")
- **Visual Status** - Groups highlighted by fill status (insufficient/optimal/excessive)
- **Quick Add** - [+ Add] buttons open filtered item selector
- **Drag & Drop** - Drag items from Entity Pool to specific groups
- **Progress Bar** - Shows bundle completion progress
- **Keyboard Shortcuts** - Esc to exit focus mode

#### New Components
- `BundleFocusView.vue` - Main focus mode view
- `BundleItemGroup.vue` - Collapsible group for each item type

#### Entry Points
- **Focus button [~]** on bundle panel header
- **"Create & Edit"** button in Bundle Creator modal

### Changed
- BundlePanel now has focus button alongside edit button
- BundleCreator has two buttons: "Create" and "Create & Edit"
- App.vue supports view mode switching (grid/focus)

---

## [1.1.0] - 2026-01-18 (Final)

### Added

#### Bundle Creator (from Template)
- **Create Bundle from Template** - Modal to create bundles from presets
- **Template Selection** - Choose from bundle templates (starter_club, etc.)
- **Requirements Preview** - See what items are needed
- **Auto-selection** - Random mode picks available items automatically
- **Manual mode** - Create empty bundle and add items later
- **"+ Bundle" button** in header

#### Settings Modal
- **Templates Tab** - View, edit, create, delete item and bundle templates
- **Interface Tab** - Theme, grid columns, preview settings, auto-save toggle
- **Data Tab** - Export/import settings, clear images, reset to defaults
- **Template Editor** - Edit template JSON directly
- **Settings button** in header

#### New Components
- `BundleCreator.vue` - Create bundle from template modal
- `SettingsModal.vue` - Full settings management with tabs

### Changed
- Header now has "+ Bundle" and Settings buttons

---

## [1.1.0] - 2026-01-18 (Phase 3 - Complete)

### Added

#### Validation System
- **Real-time validation** - Automatic validation of all entities
- **Validation rules**: Invalid JSON, duplicate ItemId, empty DisplayName, empty bundles, missing bundle items, non-standard ItemId format
- **Visual indicators** - Error (red) and warning (yellow) badges on entity cards
- **Auto-fix** - One-click fix for some issues (e.g., empty DisplayName)

#### Warnings Dashboard
- **Centralized issue tracking** - Collapsible panel showing all validation issues
- **Filter by severity** - Toggle errors/warnings visibility
- **Quick navigation** - Click to view and highlight problematic item
- **Issue counts** - Real-time error and warning counters

#### Undo/Redo System
- **Full history support** - Track all changes (create, edit, delete, move)
- **Keyboard shortcuts** - Ctrl+Z (undo), Ctrl+Y (redo)
- **50 actions history** - Rolling history buffer
- **Header controls** - Undo/Redo buttons in app header

#### Auto-save System
- **Automatic backup** - Saves to localStorage every 30 seconds
- **Session restore** - Prompt to restore on page reload
- **Unsaved indicator** - Shows "Unsaved" status in header
- **Before unload warning** - Warns when leaving with unsaved changes

#### New Components
- `WarningsDashboard.vue` - Validation issues panel

#### New Composables
- `useValidation.js` - Validation rules and issue tracking
- `useHistory.js` - Undo/redo with keyboard shortcuts
- `useAutoSave.js` - Auto-save and session restore

### Changed
- Updated `EntityCard.vue` - Now shows validation badges
- Updated `App.vue` - Integrated all Phase 3 features (history, auto-save, warnings)

---

## [1.1.0] - 2026-01-18 (Phase 2)

### Added

#### Image Management System
- **IndexedDB Storage** - Images stored locally in browser IndexedDB
- **Image Upload** - Drag & drop or click to browse images
  - PNG/JPG support, max 5MB
  - Auto-resize to 512px max dimension
- **Image Preview** - Entity cards show thumbnail preview
- **Export with Images** - ZIP export includes images folder

#### Template System
- **Template Selector** - Quick template selection when creating new entities
- **Pre-filled Forms** - Templates populate form fields automatically
- Item templates for: player, staff, team, tactic, club

#### New Components
- `ImageUploader.vue` - Drag & drop image upload with preview
- Updated `EntityCard.vue` - Now shows image thumbnails
- Updated `EntityEditor.vue` - Template selector + Image upload
- Updated `BundleEditor.vue` - Image upload for bundles

#### New Composables
- `useImageManager.js` - IndexedDB image storage management

#### Export Enhancements
- **ZIP Export** - Export catalog as ZIP with images
  - Dropdown menu: "Export JSON only" or "Export ZIP with images"
  - Images in `images/{itemClass}/{itemId}.{ext}` format
  - Image count badge on export button

### Changed
- Entity cards now display in flex layout to accommodate thumbnails
- CustomData now stores `imagePath` for image references

---

## [1.1.0] - 2026-01-18 (Phase 1)

### Added

#### Bundle Editor
- **Edit bundle properties** - Double-click on bundle header to open editor
- Edit DisplayName, Description, CustomData (JSON), Tags
- View bundle contents (read-only list)
- Edit Virtual Currencies (BundledVirtualCurrencies)
- Delete bundle with confirmation

#### Flexible Bundle Types
- Support for any ItemClass as bundle (not just "club")
- Bundle type tabs for quick filtering
- Auto-detection of bundle types from data

#### Unassigned Items Filter
- Checkbox filter "Show only unassigned" in Entity Pool
- Unassigned count badge
- Stats bar showing total/unassigned counts

#### Settings Storage
- Persistent settings in localStorage
- Item templates for quick entity creation
- Bundle templates (presets) for creating bundles
- UI preferences storage

#### New Components
- `BundleEditor.vue` - Modal for editing bundle properties
- `TagEditor.vue` - Reusable tag chips editor
- `VirtualCurrencyEditor.vue` - Currency editor for bundles

#### New Composables
- `useSettings.js` - Settings and templates management

### Changed
- Updated EntityPool with unassigned filter
- Updated BundleGrid with type tabs
- Updated BundlePanel with edit button and double-click
- Wider sidebar (320px)

### Technical
- Added dependencies: idb, jszip, file-saver (for Phase 2)

---

## [1.0.0] - 2026-01-18

### Added
- Initial release of PlayFab Bundle Editor

#### Core Features
- **JSON Import/Export** - Load and save PlayFab catalog files with full structure preservation
- **Entity Pool** - Left panel showing all unassigned entities
  - Filter by ItemClass type
  - Search by DisplayName or ItemId
  - Sort by name, type, or ID
- **Bundle Grid** - Dynamic grid of all bundles (any ItemClass with BundledItems)
  - Filter by bundle type
  - Auto-calculated statistics (Power, Balance, Item count)
  - Type counters (players, staff, teams, tactics)

#### Drag & Drop
- Drag entities from Pool to any Bundle
- Move entities between Bundles
- Return entities from Bundle to Pool
- Visual feedback during drag operations

#### Entity Management
- **Edit entities** (double-click) - Modify DisplayName, Description, CustomData, Tags
- **Create new entities** - Auto-generate ItemId, select ItemClass, set properties
- **Delete entities** - With confirmation dialog, removes from all bundles

#### UI/UX
- Color-coded entity cards by ItemClass
- Emoji icons for entity types (⚽ player, 👔 staff, 🏆 team, 📋 tactic, 🏟️ location)
- Stats display (power, level, balance, position) parsed from CustomData
- Tag chips on entity cards
- Welcome screen with feature overview

### Technical
- Vue 3 + Composition API
- Vite build tool
- VueDraggable for drag & drop
- Reactive state management with composables
- Dynamic ItemClass detection (supports any bundle types, not just clubs)
