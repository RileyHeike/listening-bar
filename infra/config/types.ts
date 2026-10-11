/** Per-environment infrastructure settings (docs/infrastructure.md). */
export interface EnvConfig {
  kind: 'production' | 'staging' | 'preview' | 'sandbox';
  /**
   * Lambda grouping: group name → module names ("*" = every module not
   * listed elsewhere). Platform routes (/api/room) go to the group listing
   * "room", else the "*" group. Moving a module needs no module change.
   */
  lambdaGroups: Record<string, string[]>;
  /** Own S3 + CloudFront site (production, staging). Previews share PreviewSite. */
  site: boolean;
  /** Stateful resources survive stack deletion. */
  retainData: boolean;
  pointInTimeRecovery: boolean;
  terminationProtection: boolean;
  /** Dev-only routes (control panel sandbox mode). Never in production. */
  devRoutes: boolean;
  /** CloudWatch alarms on API 5xx and Lambda errors. */
  alarms: boolean;
}
