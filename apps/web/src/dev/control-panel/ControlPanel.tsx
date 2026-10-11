import type { EventType, Phase } from '@bar/core';
import { PHASES, registry } from '@bar/core';
import { eventFixtures } from '@bar/fixtures';
import type { Lights, Side } from '@bar/room';
import {
  $lights,
  $live,
  $phase,
  $side,
  $snapshotStatus,
  $sound,
  setLights,
  setSide,
  setSound,
  useRoomStore,
} from '@bar/room';
import {
  $phaseOverride,
  $reducedMotionOverride,
  heldState,
  publishLocal,
  publishSandbox,
  sandboxAvailable,
  setPhaseOverride,
  setReducedMotionOverride,
} from '@bar/room/dev';
import { useState } from 'react';

type Mode = 'local' | 'sandbox';

const OPEN_KEY = 'bar:control-panel:open';

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) !== 'false';
  } catch {
    return true;
  }
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string; disabled?: boolean; title?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="row">
      <span className="label">{label}</span>
      <div className="segmented" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            disabled={option.disabled}
            title={option.title}
            onClick={() => {
              onChange(option.value);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function EventRow({
  type,
  mode,
  onResult,
}: {
  type: EventType;
  mode: Mode;
  onResult: (line: string) => void;
}) {
  const fixtures = eventFixtures[type];
  const [index, setIndex] = useState(0);
  const definition = registry.get(type);

  const fire = async () => {
    const fixture = fixtures[index] ?? fixtures[0];
    try {
      const id =
        mode === 'local'
          ? publishLocal(type, fixture.data as never)
          : await publishSandbox(type, fixture.data as never);
      onResult(`✓ ${type} (${mode}) ${id.slice(-6)}`);
    } catch (error) {
      onResult(`✖ ${type}: ${(error as Error).message}`);
    }
  };

  return (
    <li className="event">
      <span className="event-type" title={definition.description}>
        {type}
        <span className="event-meta">
          {definition.domain} · {definition.kind}
        </span>
      </span>
      <select
        aria-label={`${type} fixture`}
        value={index}
        onChange={(event) => {
          setIndex(Number(event.target.value));
        }}
      >
        {fixtures.map((fixture, i) => (
          <option key={fixture.label} value={i}>
            {fixture.label}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => void fire()}>
        Fire
      </button>
    </li>
  );
}

export function ControlPanel() {
  const [open, setOpen] = useState(readOpen);
  const [mode, setMode] = useState<Mode>('local');
  const [log, setLog] = useState<string[]>([]);
  const lights = useRoomStore($lights);
  const side = useRoomStore($side);
  const sound = useRoomStore($sound);
  const phase = useRoomStore($phase);
  const phaseOverride = useRoomStore($phaseOverride);
  const reducedOverride = useRoomStore($reducedMotionOverride);
  const live = useRoomStore($live);
  const snapshot = useRoomStore($snapshotStatus);

  const toggle = () => {
    setOpen((value) => {
      try {
        localStorage.setItem(OPEN_KEY, String(!value));
      } catch {
        // Not persisted; fine for a dev tool.
      }
      return !value;
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        className="launcher"
        onClick={toggle}
        aria-label="Open the control panel"
      >
        ◐
      </button>
    );
  }

  const sandbox = sandboxAvailable();
  return (
    <section className="panel" aria-label="Control panel (dev only)">
      <header>
        <strong>Control panel</strong>
        <span className="status">
          {live} · snapshot {snapshot}
        </span>
        <button
          type="button"
          className="close"
          onClick={toggle}
          aria-label="Close the control panel"
        >
          ×
        </button>
      </header>

      <div className="row">
        <label className="label" htmlFor="bar-phase">
          Phase
        </label>
        <select
          id="bar-phase"
          value={phaseOverride ?? 'clock'}
          onChange={(event) => {
            const value = event.target.value;
            setPhaseOverride(value === 'clock' ? null : (value as Phase));
          }}
        >
          <option value="clock">Clock ({phaseOverride ? 'off' : phase})</option>
          {PHASES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <Segmented<Lights>
        label="Lights"
        value={lights}
        onChange={setLights}
        options={[
          { value: 'dim', label: 'Dim' },
          { value: 'up', label: 'Up' },
        ]}
      />
      <Segmented<Side>
        label="Side"
        value={side}
        onChange={setSide}
        options={[
          { value: 'A', label: 'A' },
          { value: 'B', label: 'B' },
        ]}
      />
      <Segmented<'on' | 'off'>
        label="Sound"
        value={sound ? 'on' : 'off'}
        onChange={(value) => {
          setSound(value === 'on');
        }}
        options={[
          { value: 'off', label: 'Off' },
          { value: 'on', label: 'On' },
        ]}
      />
      <Segmented<'os' | 'reduce' | 'allow'>
        label="Reduced motion"
        value={reducedOverride === null ? 'os' : reducedOverride ? 'reduce' : 'allow'}
        onChange={(value) => {
          setReducedMotionOverride(value === 'os' ? null : value === 'reduce');
        }}
        options={[
          { value: 'os', label: 'OS' },
          { value: 'reduce', label: 'Reduce' },
          { value: 'allow', label: 'Allow' },
        ]}
      />

      <h2>Events</h2>
      <Segmented<Mode>
        label="Mode"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'local', label: 'Local' },
          {
            value: 'sandbox',
            label: 'Sandbox',
            disabled: !sandbox,
            title: sandbox
              ? 'Publish through the sandbox backend'
              : 'Run `pnpm sandbox:deploy` and `pnpm dev` to enable',
          },
        ]}
      />
      <ul className="events">
        {registry.types.map((type) => (
          <EventRow
            key={type}
            type={type}
            mode={mode}
            onResult={(line) => {
              setLog((lines) => [line, ...lines].slice(0, 4));
            }}
          />
        ))}
      </ul>
      <ol className="log" aria-live="polite">
        {log.map((line, i) => (
          <li key={`${i}-${line}`}>{line}</li>
        ))}
      </ol>
      <details>
        <summary>Held state ({heldState().length})</summary>
        <ul className="held">
          {heldState().map((envelope) => (
            <li key={envelope.id}>
              {envelope.type}{' '}
              <span className="event-meta">{new Date(envelope.at).toLocaleTimeString()}</span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
