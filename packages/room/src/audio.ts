import { $sound } from './stores.ts';

export type AudioChannel = 'ambient' | 'effects';

const RAMP_SECONDS = 0.4;

/**
 * Web Audio skeleton. Nothing plays until the visitor turns sound on and has
 * interacted with the page (browsers require a gesture). Master gain follows
 * the `sound` store and drops to zero while the tab is hidden. Persists
 * across client-router navigations because it lives in the runtime.
 * The foundation ships no sound assets.
 */
export function createAudioManager(createContext: () => AudioContext = () => new AudioContext()) {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  const channels = new Map<AudioChannel, GainNode>();
  let gestured = false;

  const targetGain = () => ($sound.get() && !document.hidden ? 1 : 0);

  const applyGain = () => {
    if (!context || !master) return;
    master.gain.setTargetAtTime(targetGain(), context.currentTime, RAMP_SECONDS / 3);
  };

  const ensureContext = () => {
    if (context || !gestured || !$sound.get()) return;
    context = createContext();
    master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);
    for (const name of ['ambient', 'effects'] as const) {
      const gain = context.createGain();
      gain.connect(master);
      channels.set(name, gain);
    }
    applyGain();
  };

  const onGesture = () => {
    gestured = true;
    ensureContext();
    void context?.resume();
  };

  return {
    /** Wire gesture, visibility, and sound-store listeners. */
    start(): () => void {
      const unsubscribe = $sound.listen(() => {
        ensureContext();
        applyGain();
      });
      window.addEventListener('pointerdown', onGesture, { passive: true });
      window.addEventListener('keydown', onGesture);
      document.addEventListener('visibilitychange', applyGain);
      return () => {
        unsubscribe();
        window.removeEventListener('pointerdown', onGesture);
        window.removeEventListener('keydown', onGesture);
        document.removeEventListener('visibilitychange', applyGain);
      };
    },
    /** A channel's input node, or null until audio is unlocked. */
    channel(name: AudioChannel): GainNode | null {
      return channels.get(name) ?? null;
    },
    get context(): AudioContext | null {
      return context;
    },
  };
}

export type AudioManager = ReturnType<typeof createAudioManager>;
