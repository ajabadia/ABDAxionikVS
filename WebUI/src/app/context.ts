/**
 * ABDAxionikVS — app/context.ts
 * Shared mutable bootstrap context. Every setup module receives it, fills its
 * own part, and reads the rest lazily at event time (never at construction),
 * so construction order never causes temporal-dead-zone traps.
 */
import type { AxionikNavbar } from '../ui/Navbar.js';
import type { BankDrawer } from '../ui/BankDrawer.js';
import type { NukeDrawer } from '../ui/NukeDrawer.js';
import type { HardwareDumpsDrawer } from '../ui/HardwareDumpsDrawer.js';
import type { CalibrationDrawer } from '../ui/CalibrationDrawer.js';
import type { TopLcdBar } from '../ui/TopLcdBar.js';
import type { ControllersPanel } from '../ui/ControllersPanel.js';
import type { SilverPanel } from '../ui/SilverPanel.js';
import type { BlenderPanel } from '../ui/BlenderPanel.js';
import type { FilterPanel } from '../ui/FilterPanel.js';
import type { EnvelopeMasterPanel } from '../ui/EnvelopeMasterPanel.js';
import type { ShapersPanel } from '../ui/ShapersPanel.js';
import type { DrawerManager } from '../ui/Drawers.js';
import type { ThemeManager } from '../utils/themeManager.js';
import type { TrajectoryStick2D } from '../ui/TrajectoryStick2D.js';
import type { DragDropHandler } from '../ui/DragDropHandler.js';
import type { createMidiLearnStore } from '@abdsynths/shared/components';
import type { ParamUpdateCtx } from './paramUpdate.js';
import type { ResynatorUi } from './resynatorUi.js';

export type MidiLearnStore = ReturnType<typeof createMidiLearnStore>;

export interface TrajectorySticks {
  r1Scape: TrajectoryStick2D | null;
  r1Sphere: TrajectoryStick2D | null;
  r2Scape: TrajectoryStick2D | null;
  r2Sphere: TrajectoryStick2D | null;
}

export interface AppState {
  currentPresetName: string;
  currentR1ModelName: string;
  currentR2ModelName: string;
  targetResynatorForModelPick: 1 | 2;
  currentZoom: number;
}

export interface AppCtx {
  app: HTMLElement;
  navContainer: HTMLElement;
  lcdBarContainer: HTMLElement;
  drawerManager: DrawerManager;
  themeManager: ThemeManager;
  state: AppState;
  resynator: ResynatorUi | null;
  navbar: AxionikNavbar | null;
  bankDrawer: BankDrawer | null;
  nukeDrawer: NukeDrawer | null;
  hardwareDumpsDrawer: HardwareDumpsDrawer | null;
  calibrationDrawer: CalibrationDrawer | null;
  topLcdBar: TopLcdBar | null;
  controllersPanel: ControllersPanel | null;
  silverPanel: SilverPanel | null;
  blenderPanel: BlenderPanel | null;
  filterPanel: FilterPanel | null;
  envelopeMasterPanel: EnvelopeMasterPanel | null;
  shapersPanel: ShapersPanel | null;
  sticks: TrajectorySticks;
  midiLearnStore: MidiLearnStore | null;
  dragDropHandler: DragDropHandler | null;
  paramUpdate: ParamUpdateCtx | null;
  /** Drawer-id -> reopen function, for reactive re-render on locale change. */
  drawerReopen: Record<string, () => void>;
}

export function createInitialState(): AppState {
  return {
    currentPresetName: '000 InitSound',
    currentR1ModelName: '511 sinew',
    currentR2ModelName: '511 sinew',
    targetResynatorForModelPick: 1,
    currentZoom: parseFloat(document.body.style.zoom) || 1.0,
  };
}
