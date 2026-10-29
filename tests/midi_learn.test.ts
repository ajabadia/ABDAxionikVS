// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxionikNavbar } from '../WebUI/src/ui/Navbar';
import { PARAM_DEFINITIONS } from '../WebUI/src/generated/parameters.gen';
import {
    createMidiLearnStore,
    attachMidiLearnUI,
    createMidiLearnDrawerContent,
    MIDI_SOURCE_TYPES,
    MIDI_CURVE_TYPES
} from '@abdsynths/shared/components';

describe('Sistema Canónico MIDI Learn & CC/NRPN Mapping Matrix (N:M) en ABDAxionikVS', () => {
    beforeEach(() => {
        window.localStorage.clear();
        document.body.innerHTML = '';
    });

    it('renderiza el botón MIDI en la cabecera de AxionikNavbar y la opción en el menú Edit', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const onToggleMidiLearn = vi.fn();
        const navbar = new AxionikNavbar(container, {
            onConfigureFolder: vi.fn(),
            onImportModelFolder: vi.fn(),
            onImportModelZip: vi.fn(),
            onLoadPreset: vi.fn(),
            onSavePreset: vi.fn(),
            onInitPreset: vi.fn(),
            onToggleBank: vi.fn(),
            onToggleMatrix: vi.fn(),
            onToggleNuke: vi.fn(),
            onToggleMidiLearn,
            onToggleMfx: vi.fn(),
            onToggleSettings: vi.fn(),
            onToggleTheme: vi.fn(),
            onSelectTheme: vi.fn(),
            onZoomChange: vi.fn()
        });

        const midiBtn = container.querySelector('#btn-nav-midi') as HTMLButtonElement | null;
        expect(midiBtn).not.toBeNull();
        expect(midiBtn?.querySelector('svg')).not.toBeNull();

        midiBtn?.click();
        expect(onToggleMidiLearn).toHaveBeenCalledTimes(1);

        // Abrir el menú Edit para renderizar sus elementos en .nav-dropdown
        const editMenuBtn = Array.from(container.querySelectorAll('.nav-menu-bar button, .nav-menu-bar [role="menuitem"]'))
            .find((el) => el.textContent?.trim() === 'Edit') as HTMLElement | undefined;
        editMenuBtn?.click();

        const menuItem = container.querySelector('.nav-item[data-action="toggleMidiLearn"]') as HTMLElement | null;
        expect(menuItem).not.toBeNull();
        expect(menuItem?.textContent).toContain('MIDI Learn & CC Mapping Matrix');
        menuItem?.click();
        expect(onToggleMidiLearn).toHaveBeenCalledTimes(2);

        navbar.setMidiLearnState(true, 3);
        expect(midiBtn?.classList.contains('is-learning')).toBe(true);
        expect(midiBtn?.classList.contains('has-mappings')).toBe(true);
        expect(midiBtn?.title).toContain('3');
    });

    it('integra el store N:M, el menú contextual y los indicadores sobre controles 1D, 2D y <input> con PARAM_DEFINITIONS', () => {
        const syncedPayloads: unknown[] = [];
        const store = createMidiLearnStore({
            storageKey: 'axionik_test_midi_learn',
            onSyncToHost: (payload: unknown) => syncedPayloads.push(payload)
        });

        const root = document.createElement('div');
        root.innerHTML = `
            <div id="cutoff-knob" data-param-index="274" style="position:relative; width:38px; height:38px;"></div>
            <div id="stick-r1" data-param-x="36" data-param-y="37" style="position:relative; width:120px; height:120px;"></div>
            <div class="env-slider-wrap" style="position:relative;">
                <input id="env-slider" type="range" data-param-index="40" min="0" max="127" value="64" />
            </div>
        `;
        document.body.appendChild(root);

        const getParamMeta = (paramIndex: number) => {
            const def = PARAM_DEFINITIONS[paramIndex];
            return {
                name: def ? (def.vstDisplay || def.key) : `Param [${paramIndex}]`,
                group: def ? def.group : 'Synth',
                key: def ? def.key : `param_${paramIndex}`
            };
        };

        const ui = attachMidiLearnUI({
            root,
            store,
            getParamMeta
        });

        // 1. Asignamos CC 74 al Cutoff [274] y a un slider <input> [40] (Macro 1:N)
        store.upsertMapping({
            targetIndex: 274,
            sourceType: MIDI_SOURCE_TYPES.CC,
            channel: 0,
            number: 74,
            minNorm: 0,
            maxNorm: 1,
            invert: false,
            curve: MIDI_CURVE_TYPES.LINEAR
        });

        store.upsertMapping({
            targetIndex: 40,
            sourceType: MIDI_SOURCE_TYPES.CC,
            channel: 0,
            number: 74,
            minNorm: 0.2,
            maxNorm: 0.8,
            invert: true,
            curve: MIDI_CURVE_TYPES.EXPONENTIAL
        });

        // Verifica que el puntito se inyecta tanto en el div del knob como en el contenedor padre del <input>
        const knobIndicator = root.querySelector('#cutoff-knob .abd-midi-learn-indicator');
        expect(knobIndicator).not.toBeNull();

        const sliderIndicator = root.querySelector('.env-slider-wrap .abd-midi-learn-indicator');
        expect(sliderIndicator).not.toBeNull();

        // 2. Clic derecho sobre el TrajectoryStick2D ofrece opciones para Eje X [36] y Eje Y [37]
        const stickEl = root.querySelector('#stick-r1') as HTMLElement;
        stickEl.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 50, clientY: 50 }));

        const menuText = document.body.textContent || '';
        expect(menuText).toContain('[36]');
        expect(menuText).toContain('[37]');

        // 3. Renderiza el Drawer deslizable con las asignaciones activas
        const drawerEl = createMidiLearnDrawerContent({
            store,
            parameters: PARAM_DEFINITIONS.map((p) => ({
                index: p.index,
                name: p.vstDisplay || p.key,
                group: p.group
            })),
            synthName: 'ABDAxionikVS'
        });
        document.body.appendChild(drawerEl);

        expect(drawerEl.querySelectorAll('.abd-midi-row').length).toBe(2);
        expect(drawerEl.textContent).toContain('1:2 MACRO');
        expect(drawerEl.textContent).toContain(PARAM_DEFINITIONS[274].vstDisplay || PARAM_DEFINITIONS[274].key);
        expect(syncedPayloads.length).toBeGreaterThan(0);

        ui.destroy();
    });

    it('libera automáticamente la espera de MIDI Learn a los 10 segundos con cuenta regresiva y relojito SVG, o con clic izquierdo / Escape', () => {
        vi.useFakeTimers();
        try {
            const store = createMidiLearnStore({
                persist: false
            });

            const root = document.createElement('div');
            root.innerHTML = `<div id="cutoff-knob" data-param-index="274"></div>`;
            document.body.appendChild(root);

            const ui = attachMidiLearnUI({ root, store });

            // 1. Cuenta regresiva de 10s con icono de reloj SVG y liberación automática al llegar a 0
            store.startLearning(274, '', 'replace');
            expect(store.getState().isLearning).toBe(true);
            expect(store.getState().learnRemainingSeconds).toBe(10);

            const waitingBadge = root.querySelector('#cutoff-knob .abd-midi-learn-indicator.is-waiting');
            expect(waitingBadge).not.toBeNull();
            expect(waitingBadge?.querySelector('.abd-midi-learn-clock svg')).not.toBeNull();
            expect(waitingBadge?.textContent).toContain('10s');

            vi.advanceTimersByTime(3000);
            expect(store.getState().learnRemainingSeconds).toBe(7);
            expect(waitingBadge?.textContent).toContain('7s');

            vi.advanceTimersByTime(7001);
            expect(store.getState().isLearning).toBe(false);
            expect(store.getState().learnRemainingSeconds).toBe(0);

            // 2. Liberación inmediata al hacer clic izquierdo en cualquier parte de la interfaz
            store.startLearning(274, '', 'replace');
            expect(store.getState().isLearning).toBe(true);
            window.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
            expect(store.getState().isLearning).toBe(false);

            // 3. Liberación con tecla Escape
            store.startLearning(274, '', 'replace');
            expect(store.getState().isLearning).toBe(true);
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            expect(store.getState().isLearning).toBe(false);

            ui.destroy();
        } finally {
            vi.useRealTimers();
        }
    });
});
