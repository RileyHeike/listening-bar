import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';

export interface StationBoundaryProps {
  /** Station id, for error reports. */
  station: string;
  /** What to render if the island throws: the station's static shell. */
  fallback: ReactNode;
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * Wraps every station island. If the island throws, it falls back to the
 * static shell instead of taking the page down.
 */
export class StationBoundary extends Component<StationBoundaryProps, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(
      `[station:${this.props.station}] island failed; showing static shell`,
      error,
      info,
    );
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
