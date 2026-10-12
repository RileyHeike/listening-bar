import type { GitHubRepository } from '../stacks/ci-access.ts';

/**
 * Project-wide settings. The bar's name and domain are an open decision
 * (docs/decisions.md): until `domain` is set, sites deploy on CloudFront
 * default domains and the shared preview site cannot be deployed.
 */
export const project = {
  name: 'listening-bar',
  /** The only AWS account this project deploys to; stacks are pinned to it. */
  account: '441659297085',
  region: 'us-west-2',
  /** Certificates for CloudFront must live here. */
  certificateRegion: 'us-east-1',
  /** e.g. "example.com" once the bar is named and the domain registered. */
  domain: undefined as string | undefined,
  /**
   * GitHub repository allowed to assume CI roles via OIDC. GitHub issues
   * immutable subjects ("repo:owner@<owner id>/name@<repo id>:…"), so the
   * numeric ids are part of the trust: a renamed or re-created repo with the
   * same name cannot assume the roles.
   */
  github: {
    repository: 'RileyHeike/listening-bar',
    ownerId: 58667210,
    repositoryId: 1414868033,
  } as GitHubRepository | undefined,
  /** Address for the AWS Budgets alert and production alarms. */
  alertEmail: 'rileyheike@gmail.com' as string | undefined,
  /** Monthly budget alert threshold, USD. */
  monthlyBudgetUsd: 5,
} as const;
