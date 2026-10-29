import { BankDrawer } from '../ui/BankDrawer.js';
import { AxionikNavbar } from '../ui/Navbar.js';

export function setupKeyboardShortcuts(
  bankDrawer: BankDrawer,
  navbar: AxionikNavbar | null,
  openSettingsDrawer: () => void
) {
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const isCtrl = e.ctrlKey || e.metaKey;
    if (isCtrl && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault();
      bankDrawer.toggle('models', 'global');
    } else if (isCtrl && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      navbar?.toggleNuke();
    } else if (isCtrl && (e.key === 'm' || e.key === 'M')) {
      e.preventDefault();
      navbar?.toggleMatrix();
    } else if (isCtrl && (e.key === 'l' || e.key === 'L')) {
      e.preventDefault();
      navbar?.toggleMidiLearn();
    } else if (isCtrl && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      navbar?.toggleMfx();
    } else if (isCtrl && e.key === ',') {
      e.preventDefault();
      openSettingsDrawer();
    } else if (isCtrl && e.key === '.') {
      e.preventDefault();
      navbar?.toggleHardwareDumps();
    } else if (isCtrl && e.key === ';') {
      e.preventDefault();
      navbar?.toggleCalibration();
    }
  });
}
