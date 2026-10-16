# Vessel Fleet Operations Console — Implementation Plan

## 1. Objective and Success Criteria

Transform the current single-page vessel dashboard into a responsive multi-route fleet operations console with all navigation moved from the sidebar into a horizontal top navbar.

The implementation is a frontend prototype with realistic simulated realtime data. It must:

- Keep **Overview** as the command-center landing page.
- Provide complete pages for **Live Marine Traffic**, **Vessel Assets**, **Dashboard Monitoring**, and **Live Logs**.
- Use English UI copy while retaining standard maritime terms such as AIS, MMSI, SOG, COG, heading, bearing, and NM.
- Work without a backend, persist user-created configuration and layouts locally, and expose clean data/service boundaries for later API/WebSocket replacement.
- Remain usable on desktop, tablet, and mobile; operationally dense screens should prioritize desktop while degrading into drawers, stacked panels, and horizontal scrolling where necessary.
- Preserve the existing navy/teal professional maritime visual language.

## 2. Product Concept Refinement

The requested four functional areas are sufficient for the core prototype. Add the following concepts because they are important in a realistic fleet operations workflow:

1. **Data freshness and quality**
   - Every vessel, telemetry metric, AIS target, and raw log has a timestamp and freshness state: `live`, `delayed`, `stale`, or `offline`.
   - Show last update time and connection quality so operators can distinguish a stationary vessel from lost telemetry.

2. **Agent health and diagnostics**
   - Connectivity agents expose connected/disconnected/testing state, packets per minute, last packet time, decoder channels, and recent errors.
   - The prototype's “Test Connection” simulates handshake/decoder validation and clearly labels itself as simulated.

3. **Alerts and acknowledgment**
   - Overview and Monitoring show operational alarms such as speed threshold, stale telemetry, geofence entry, and agent disconnect.
   - Users can acknowledge alerts locally; acknowledgment state persists.

4. **Historical context**
   - Marine Traffic includes a selectable track window (30 min, 1 h, 6 h) and track visibility toggle.
   - Monitoring charts use rolling simulated history.
   - Logs support pause/resume without discarding newly arriving records; paused records are buffered and shown when resumed.

5. **Audit-safe configuration behavior**
   - Vessel/agent edits display validation errors, save timestamps, and a destructive confirmation before deletion.
   - MMSI and agent names are unique in the local dataset.

6. **Operational empty/error states**
   - Include no-vessel, no-agent, no-filter-results, disconnected-agent, stale-data, unavailable-map-tile, and unsupported-fullscreen states.

Out of scope for this phase: actual TCP sockets, backend authentication, multi-user authorization, cloud persistence, real AIS feed, production chart licensing, and real geofence/routing calculations. Browser clients cannot connect directly to arbitrary TCP sources; production integration will require a server/edge gateway that converts TCP/NMEA traffic to authenticated WebSocket or HTTP streams.

## 3. Navigation and Application Shell

### Desktop navbar

Use one sticky horizontal navbar:

- Left: NautiCore logo and product identity.
- Center: route links for Overview, Marine Traffic, Vessel Assets, Monitoring, and Live Logs.
- Right: global vessel search, realtime status, notification button, and profile menu.
- Active route uses a teal indicator/pill and proper `aria-current="page"`.

### Responsive behavior

- At tablet widths, collapse search into an icon-triggered overlay.
- At mobile widths, replace center links with a hamburger-triggered top-anchored navigation drawer; this is only the responsive representation of the navbar, not a permanent sidebar.
- Keep system status and profile accessible in the mobile menu.
- The application shell owns navbar, notifications, shared simulator context, and route outlet.

### Routes

Use React Router Data mode with `RouterProvider`:

- `/` — Overview
- `/marine-traffic` — Live Marine Traffic
- `/vessels` — Vessel Assets
- `/monitoring` — Dashboard Monitoring
- `/logs` — Live Logs
- `*` — branded not-found view with return action

## 4. Dependencies

Add only the libraries needed for the requested behavior:

- `react-router` — route-aware multi-page application using Data mode.
- `leaflet` and `react-leaflet` — interactive GIS map.
- `@types/leaflet` — Leaflet TypeScript declarations if not bundled by the installed release.
- `react-grid-layout` — draggable/resizable monitoring widgets and responsive breakpoints.
- `lucide-react` — consistent accessible icon set instead of maintaining a growing inline SVG switch.

Continue using Tailwind CSS v4 and the existing DM Sans font setup. Import Leaflet and grid-layout CSS once from the application CSS entry or app bootstrap.

## 5. Proposed Source Structure

Refactor the large current `src/App.tsx` into focused modules:

```text
src/
  app/
    App.tsx                 # RouterProvider only
    routes.tsx              # createBrowserRouter route definitions
    AppShell.tsx            # shared navbar, notifications, Outlet
  components/
    navigation/TopNavbar.tsx
    common/                  # PageHeader, StatusBadge, EmptyState, Modal, FormField
    map/                     # MarineMap, vessel/AIS markers, map controls, detail panel
    monitoring/             # widget shell and widget renderers
  pages/
    OverviewPage.tsx
    MarineTrafficPage.tsx
    VesselAssetsPage.tsx
    MonitoringPage.tsx
    LiveLogsPage.tsx
    NotFoundPage.tsx
  data/
    seed.ts                  # initial vessels, agents, telemetry, AIS, logs, tracks
  domain/
    types.ts                 # shared domain interfaces/unions
  hooks/
    useFleetSimulator.ts
    useLocalStorage.ts
    useFullscreen.ts
  state/
    FleetProvider.tsx        # app-wide data/actions and simulation lifecycle
  services/
    fleetRepository.ts       # localStorage CRUD adapter
    simulator.ts             # deterministic updates and bounded history
  index.css
  main.tsx
```

Avoid over-fragmenting tiny components; shared components should exist only when reused or when they isolate complex behavior.

## 6. Shared Domain Model and Data Flow

### Core types

- `Vessel`: id, name, type, IMO (optional), MMSI, callSign, dimensions, draft, selectedAgentIds, createdAt, updatedAt.
- `ConnectivityAgent`: id, name, protocol (`TCP`), host, port, channels, connection status, lastPacketAt, packetsPerMinute, errors.
- `DecoderChannel`: id, standard (`NMEA2000` or `NMEA0183`), transport label (`CAN` or `RS485`), enabled, sample sentence/frame.
- One agent may enable either decoder or both decoders, matching the requested configuration.
- `NavigationSnapshot`: vesselId, position, heading, SOG, COG, ROT, depth, wind, timestamp, quality.
- `TelemetryMetric`: key, value, unit, timestamp, quality, optional thresholds.
- `TrackPoint`: vesselId, latitude, longitude, heading, speed, timestamp.
- `AisTarget`: id, AIS class A/B, MMSI, name/callSign, position, navigationStatus, SOG, COG, heading, CPA/TCPA where available, distanceNm, bearing, updatedAt.
- `RawLog`: id, timestamp, agentId, vesselId, decoder, direction, severity, rawPayload, parsedSummary.
- `Alert`: id, vesselId, type, severity, message, createdAt, acknowledgedAt.
- `WidgetConfig`: id, type, title, vesselId, metricKeys, display options, grid layout.

### State flow

- `FleetProvider` loads vessels, agents, alert acknowledgments, and dashboard layout from the repository/localStorage.
- Seed data is installed only when no saved state exists.
- A single simulator interval updates own-ship navigation, track points, AIS targets, telemetry, agent health, and raw logs. Use bounded arrays to prevent memory growth.
- Pages consume state through a typed context/hook and call explicit actions such as `createVessel`, `updateAgent`, `acknowledgeAlert`, or `setLogStreaming`.
- Persist configuration changes immediately; throttle/debounce layout persistence and do not persist every high-frequency telemetry tick.
- Keep simulator and repository behind interfaces so a later WebSocket/API adapter can replace them without rewriting pages.

### Local persistence keys

Version the stored payloads to permit future migration:

- `nauticore:v1:vessels`
- `nauticore:v1:agents`
- `nauticore:v1:monitoring-layouts`
- `nauticore:v1:alert-acknowledgments`
- `nauticore:v1:preferences`

If stored JSON is malformed or incompatible, fall back to seed data and show a non-blocking recovery notice rather than crashing.

## 7. Page Specifications

### A. Overview (`/`)

Retain the current command-center purpose but align it with the richer model:

- Fleet KPI cards: total vessels, underway, anchored/in port, active alerts.
- Compact live map preview with own ships and key alerts; link to full Marine Traffic.
- Fleet health section: agent connectivity, delayed/offline vessels, packets/minute.
- Priority vessel table with freshness and status.
- Recent alerts/activity with acknowledgment state.
- Compact telemetry trend for selected fleet/vessel.
- All cards link to the relevant detailed route/filter instead of being decorative.

### B. Live Marine Traffic (`/marine-traffic`)

#### Layout

- Full-height operations workspace under the navbar.
- Large Leaflet map with a collapsible AIS target list on the left and a target/vessel inspection drawer on the right.
- On mobile, target list and detail content become bottom sheets/drawers so the map remains usable.

#### Map layers

- OpenStreetMap base tiles.
- OpenSeaMap nautical overlay enabled by default.
- Leaflet layer control for base/nautical visibility.
- Attribution remains visible and correct.
- A map-error/fallback overlay explains external tile failure while preserving controls and target list.

#### Own ship

- Distinct own-ship marker with CSS/DivIcon heading pointer rotated from heading data.
- Breadcrumb/polyline track with points generated by the simulator.
- Track visibility toggle and history window: 30 min, 1 h, 6 h.
- Center/My Vessel control uses `map.flyTo` and selected vessel coordinates.
- Vessel selector supports multiple registered vessels.

#### AIS overlay and inspection

- Distinct Class A and Class B markers, rotated by heading/COG.
- Labels at suitable zoom include vessel name or MMSI, status, distance NM, and bearing.
- AIS list supports search, class filter, risk filter, and sort by distance.
- Clicking a marker or list item selects the same target, highlights it, centers if requested, and opens details.
- Details include MMSI, call sign, AIS class, navigation status, SOG, COG, heading, range, bearing, last update, and optional CPA/TCPA risk indicator.
- Stale targets are visually muted; selected target remains inspectable with a stale warning.

#### Map controls

- Center on own ship.
- Toggle vessel track.
- Layer selector.
- Fullscreen using the browser Fullscreen API, with state synchronized for Escape exits.
- If Fullscreen API is unavailable, disable the button with an explanatory tooltip.

### C. Vessel Assets (`/vessels`)

#### Master-detail workspace

- Left asset panel lists registered vessels with search, type/status filters, agent health, and add-vessel action.
- Right panel shows the selected vessel; on mobile, selection navigates within the same route state and the list becomes a back-accessible view.
- Empty state prompts the first vessel registration.

#### Vessel detail tabs

1. **Overview** — vessel identity, connectivity summary, data freshness, key navigation values.
2. **Navigation** — latitude/longitude, heading, SOG, COG, ROT, depth, wind, update timestamp.
3. **Sensors** — grouped engine/electrical/environmental telemetry with units, quality, and last update.
4. **Connectivity** — linked agents, enabled decoders, health, packet rate, last payload/error.
5. **Configuration** — edit identity and agent associations; delete vessel with confirmation.

#### Vessel CRUD

- Add/edit form fields: name, type, MMSI, call sign, optional IMO, and one or more selected connectivity agents.
- Validate required fields, numeric 9-digit MMSI, unique MMSI, and unique agent selections.
- Persist create/update/delete locally.
- Deleting a selected vessel safely chooses the next vessel and preserves unrelated agents.

#### Connectivity agent CRUD

- Agent management modal/drawer available from the asset workspace.
- Fields: agent name, protocol fixed to TCP, host, port, enabled decoder channels.
- Decoder channel options:
  - CAN / NMEA 2000
  - RS485 / NMEA 0183
  - both may be enabled
- Validate host presence, port integer in 1–65535, at least one decoder, and unique agent name.
- “Test Connection” runs a short simulated state sequence: testing → connected or deterministic demo failure; show latency, decoder recognition, and explicit “Simulated test” wording.
- Agent can be linked to multiple vessels; deletion warns about affected vessels and removes associations only after confirmation.

### D. Dashboard Monitoring (`/monitoring`)

#### Dashboard controls

- Vessel selector; layouts are stored per vessel.
- Edit/lock toggle to prevent accidental movement.
- Add Widget opens a catalog.
- Reset Layout restores the seeded marine layout after confirmation.
- Time range selector controls charts (15 min, 1 h, 6 h).
- Data freshness and connection status remain visible.

#### Responsive drag-and-drop grid

Use `react-grid-layout` responsive mode:

- Desktop: 12 columns.
- Tablet: 8 columns.
- Mobile: 1 column with drag/resize disabled to protect touch scrolling.
- In edit mode on desktop/tablet, widgets can be dragged and resized from explicit handles.
- Persist debounced layouts per vessel and breakpoint.
- Enforce minimum sizes per widget to avoid unreadable gauges/charts.

#### Widget catalog

Provide professional maritime variants:

- Speedometer Gauge — SOG or engine RPM, threshold arcs, current/max value.
- Compass/Heading Gauge — heading and COG comparison.
- Telemetry Card — metric, unit, delta, quality, freshness.
- KPI Card — fuel rate, range, ETA, distance, engine load.
- Time-series Chart — speed, RPM, fuel, depth, wind; SVG-based chart to avoid another chart dependency.
- Multi-series Chart — selected comparable metrics.
- Map Preview — own-ship position and recent track, non-interactive compact Leaflet view or simplified preview.
- Engine/Sensor Status — grouped state and alarm chips.

Widget settings allow title, metric selection, and display options. Widget removal requires confirmation only when it has custom settings; otherwise an undo toast is sufficient.

### E. Live Logs (`/logs`)

#### Stream table

- Dense modern table with sticky header and virtual-style bounded data (retain a maximum such as 1,000 rows in memory).
- Columns: timestamp, vessel, agent, decoder, direction, severity, parsed summary, raw payload, and row action.
- Monospace payload rendering; long payloads truncate in the table and expand in a detail drawer.
- New rows animate subtly without causing disruptive layout shifts.

#### Controls

- Agent multi-select filter.
- Vessel filter.
- Decoder filter (NMEA 2000 / NMEA 0183).
- Severity filter.
- Time range and text search.
- Auto-scroll toggle labeled Live/Paused.
- Clear view resets the current in-memory display only, not persisted asset configuration.
- Export currently filtered rows as CSV generated in the browser.

#### Pause behavior

- When live, new matching rows append and the viewport follows only if the user is already near the bottom.
- When paused, simulator data continues into a bounded buffer; show “N new logs” and merge them when resumed.
- Changing filters recomputes the visible table without changing stream state.
- Empty filter results show a clear reset-filters action.

## 8. Visual and Interaction System

- Keep navy/slate foundations, teal for active/live states, blue for information, amber for warning, red for critical, and violet only for secondary categories.
- Use light application surfaces with dark navbar; map workspace may use darker operational chrome around the map.
- Standardize cards, inputs, tabs, status pills, modals/drawers, table density, and focus rings through reusable classes/components.
- Preserve minimum 44px touch targets where practical and visible keyboard focus.
- Use proper labels, table semantics, dialogs, `aria-live` for connection/log status, and non-color status cues.
- Avoid excessive animation; honor `prefers-reduced-motion` and use restrained transitions for live updates.
- Keep numeric telemetry aligned and use tabular numerals.

## 9. Implementation Sequence

1. Install routing, map, grid, and icon dependencies.
2. Define domain types, seed fixtures, versioned local repository, simulator, and FleetProvider.
3. Create React Router Data mode setup and AppShell with the horizontal responsive navbar.
4. Extract reusable UI primitives and migrate the existing Overview into the new shell/state model.
5. Build Marine Traffic map, marker/track layers, controls, synchronized AIS list, detail drawer, and tile failure handling.
6. Build Vessel Assets master-detail view, tabs, vessel CRUD, agent CRUD, validation, local persistence, and simulated connection test.
7. Build Monitoring responsive grid, widget catalog/renderers, edit mode, configuration, and per-vessel layout persistence.
8. Build Live Logs stream, filters, pause/buffer behavior, payload drawer, bounded history, and CSV export.
9. Add responsive states, empty/error/stale states, confirmation dialogs, and accessibility refinements.
10. Run formatting and production verification, then repair any route, type, or layout issues found.

## 10. Edge Cases and Failure Handling

- No registered vessels: map and monitoring show setup actions; logs can still show agent diagnostics.
- Vessel has no linked agent: show “Not connected” rather than zero-valued live telemetry.
- Linked agent disconnected: preserve last values with stale timestamp and visual warning.
- Invalid/corrupted localStorage: recover to seed state with a dismissible notice.
- Duplicate MMSI/agent name: prevent save with field-level errors.
- Agent deletion while linked: enumerate impacted vessels before confirmation, then remove references atomically.
- Selected vessel deleted: select the next available vessel or enter empty state.
- External OSM/OpenSeaMap tile failure: show a retry/fallback notice; retain markers/list and do not crash.
- Rapid simulator ticks: use one shared timer, bounded histories, and avoid remounting the Leaflet map.
- Fullscreen Escape: listen to `fullscreenchange` so control state remains accurate.
- Paused logs: cap both visible and pending records to prevent unbounded memory growth.
- Small screens: disable monitoring drag/resize, use map drawers, and horizontally scroll dense log tables.

## 11. Verification Strategy

Follow repository commands and do not start another dev server.

### Automated checks

- Run `pnpm run format` after implementation.
- Run `pnpm run build`; it must finish successfully with no TypeScript/Vite errors.

### Functional verification in the existing preview

- Navigate directly and through navbar to all five routes; verify active state and browser back/forward behavior.
- Verify mobile navbar menu, search overlay, and no permanent sidebar remains.
- Confirm simulated own ship and AIS targets update without resetting map interaction.
- Select AIS targets from marker and list; verify synchronized details, range/bearing, and stale state.
- Toggle route track, switch history range, center map, layer visibility, and fullscreen/exit.
- Create, edit, select, and delete vessels; reload and verify persistence.
- Create/edit/test/delete agents with one and both decoder types; verify validation and vessel associations.
- Drag, resize, add, configure, remove, and reset widgets; reload and switch vessels to verify per-vessel layouts.
- Filter logs by agent/time/decoder/severity, pause/resume, verify buffered count, inspect raw payload, and export filtered CSV.
- Exercise empty states by deleting seed entities or clearing filters, then restore data.
- Check keyboard focus, dialog close behavior, labels, table semantics, reduced-motion behavior, and common desktop/mobile widths.

## 12. Completion Definition

The work is complete when all routes render substantive content, the navbar fully replaces the desktop sidebar, all specified prototype interactions work with deterministic simulated realtime data, vessel/agent configuration and widget layouts survive reloads, edge states do not crash the app, and formatting plus production build both pass.
