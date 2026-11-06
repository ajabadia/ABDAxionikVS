/**
 * ABDAxionikVS — app/panels.ts
 * Front-block mounting: hardware controllers, silver, blender, filter,
 * envelope master, master output and the three shapers. Each panel keeps
 * its own edit-drawer callback; mounts resolve lazily through ctx.
 */
import { ControllersPanel } from '../ui/ControllersPanel.js';
import { SilverPanel } from '../ui/SilverPanel.js';
import { BlenderPanel } from '../ui/BlenderPanel.js';
import { FilterPanel } from '../ui/FilterPanel.js';
import { EnvelopeMasterPanel } from '../ui/EnvelopeMasterPanel.js';
import { MasterOutputPanel } from '../ui/MasterOutputPanel.js';
import { ShapersPanel } from '../ui/ShapersPanel.js';
import type { AppCtx } from './context.js';
import type { DrawerOpeners } from './drawerOpeners.js';

export function mountPanels(ctx: AppCtx, openers: DrawerOpeners): void {
  const controllersMount = document.getElementById('controllers-mount');
  if (controllersMount) {
    ctx.controllersPanel = new ControllersPanel(controllersMount, {
      onEdit: () => openers.openMatrixDrawer('controllers'),
    });
  }

  const silverMount = document.getElementById('silver-mount');
  if (silverMount) {
    ctx.silverPanel = new SilverPanel(silverMount, {
      onEditSilver: () => openers.openSilverDrawer(),
      onEditSlicer: () => openers.openBlenderDrawer(),
    });
  }

  const blenderMount = document.getElementById('blender-mount');
  if (blenderMount) {
    ctx.blenderPanel = new BlenderPanel(blenderMount, {
      onEdit: () => openers.openBlenderDrawer(),
    });
  }

  const filterMount = document.getElementById('filter-mount');
  if (filterMount) {
    ctx.filterPanel = new FilterPanel(filterMount, {
      onEdit: () => openers.openFilterDrawer(),
    });
  }

  const envelopeMasterMount = document.getElementById('envelope-master-mount');
  if (envelopeMasterMount) {
    ctx.envelopeMasterPanel = new EnvelopeMasterPanel(envelopeMasterMount, {
      onEdit: () => openers.openEnvelopeDrawer('4l4t', 1),
    });
  }

  const masterMount = document.getElementById('master-mount');
  if (masterMount) {
    new MasterOutputPanel(masterMount);
  }

  const shapersMount = document.getElementById('shapers-mount');
  if (shapersMount) {
    ctx.shapersPanel = new ShapersPanel(shapersMount, {
      onEditR1: openers.openR1Drawer,
      onEditR2: openers.openR2Drawer,
      onEditSilver: openers.openSilverDrawer,
      onEditFreeEnv: () => openers.openEnvelopeDrawer('free', 1),
      onEditShaper: (shaper, mode) => openers.openEnvelopeDrawer(mode, shaper),
      onEditShaper3: (mode) => openers.openEffectsDrawer(mode === 'efx' ? 'master' : 'filter'),
    });
  }
}
