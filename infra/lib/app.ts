import { App, CliCredentialsStackSynthesizer, Tags } from 'aws-cdk-lib';
import type { Environment } from 'aws-cdk-lib';
import type { EnvConfig } from '../config/types.ts';
import { AccountAccessStack } from '../stacks/account-access.ts';
import { CertificateStack } from '../stacks/certificate.ts';
import type { GitHubRepository } from '../stacks/ci-access.ts';
import { CiAccessStack } from '../stacks/ci-access.ts';
import { PreviewSiteStack } from '../stacks/preview-site.ts';
import { StatefulStack } from '../stacks/stateful.ts';
import { StatelessStack } from '../stacks/stateless.ts';
import type { Extension } from './extensions.ts';
import type { DiscoveredModule } from './modules.ts';
import type { Target } from './naming.ts';

export interface ProjectSettings {
  name: string;
  account: string;
  region: string;
  certificateRegion: string;
  domain: string | undefined;
  github: GitHubRepository | undefined;
  alertEmail: string | undefined;
  monthlyBudgetUsd: number;
}

export interface BuildOptions {
  app?: App;
  project: ProjectSettings;
  /** An environment's stacks, or the account-level stacks. */
  target: Target | 'account';
  config?: EnvConfig;
  modules: readonly DiscoveredModule[];
  extensions: ReadonlyMap<string, Extension>;
  generatedDir: string;
  /** Built site for production/staging (apps/web/dist). */
  siteDist?: string | undefined;
  /**
   * Account the CLI is using. Must match `project.account`, so nothing can
   * deploy into the wrong account; left undefined in tests.
   */
  account?: string | undefined;
}

/** Host names a site serves, when the domain is known. */
function siteDomains(target: Target, domain: string | undefined): string[] | undefined {
  if (!domain) return undefined;
  if (target.kind === 'production') return [domain, `www.${domain}`];
  if (target.kind === 'staging') return [`staging.${domain}`];
  return undefined;
}

/** Origins allowed to call an environment's API from another origin. */
/**
 * Whether an environment gets its own S3 + CloudFront site. Previews share
 * one distribution once the domain exists; until then each PR gets its own.
 */
const ownsSite = (target: Target, config: EnvConfig, domain: string | undefined) =>
  config.site || (target.kind === 'preview' && !domain);

function allowedOrigins(target: Target, domain: string | undefined): string[] {
  if (target.kind === 'preview' && target.pr && domain)
    return [`https://pr-${target.pr}.preview.${domain}`];
  if (target.kind === 'sandbox') return ['http://localhost:4321'];
  return [];
}

export function buildBarApp(options: BuildOptions): App {
  const app = options.app ?? new App();
  const { project } = options;
  if (options.account && options.account !== project.account) {
    throw new Error(
      `These credentials are for account ${options.account}, but ${project.name} deploys only to ${project.account}.`,
    );
  }
  const env: Environment = { account: project.account, region: project.region };
  const certEnv: Environment = { account: project.account, region: project.certificateRegion };
  Tags.of(app).add('project', project.name);

  if (options.target === 'account') {
    Tags.of(app).add('env', 'account');
    if (project.alertEmail) {
      new AccountAccessStack(app, 'account-access', {
        env,
        projectName: project.name,
        budget: { monthlyUsd: project.monthlyBudgetUsd, email: project.alertEmail },
        // Every stack is tagged project=<name> (below), so the budget sees only this project.
        costTag: { key: 'project', value: project.name },
      });
    } else {
      console.warn(
        'No alertEmail configured: skipping the account access stack (developer role, budget).',
      );
    }
    let previews: { bucketArn: string; distributionArn: string } | undefined;
    if (!project.domain) {
      console.warn('No domain configured (open decision): skipping the shared preview site.');
    } else {
      const certificate = new CertificateStack(app, 'account-preview-certificate', {
        env: certEnv,
        crossRegionReferences: true,
        zoneName: project.domain,
        domainNames: [`*.preview.${project.domain}`],
      });
      const previewSite = new PreviewSiteStack(app, 'account-preview-site', {
        env,
        crossRegionReferences: true,
        domain: project.domain,
        certificate: certificate.certificate,
      });
      previews = {
        bucketArn: previewSite.bucket.bucketArn,
        distributionArn: `arn:aws:cloudfront::${project.account}:distribution/${previewSite.distribution.distributionId}`,
      };
    }
    // Staging and production deploys need CI access even before there is a domain.
    if (project.github) {
      new CiAccessStack(app, 'account-ci-access', {
        env,
        github: project.github,
        previews,
      });
    } else {
      console.warn('No GitHub repository configured: skipping CI access.');
    }
    return app;
  }

  const target = options.target;
  const config = options.config;
  if (!config) throw new Error(`No config for ${target.kind}.`);
  Tags.of(app).add('env', target.kind);
  Tags.of(app).add('prefix', target.prefix);

  // Preview stacks deploy with the CI role's own credentials and a scoped
  // CloudFormation execution role (see CiAccessStack).
  const synthesizer = target.kind === 'preview' ? new CliCredentialsStackSynthesizer() : undefined;
  const common = { env, ...(synthesizer ? { synthesizer } : {}) };

  const stateful = new StatefulStack(app, `${target.prefix}-stateful`, {
    ...common,
    prefix: target.prefix,
    config,
    modules: options.modules,
  });

  const domainNames = siteDomains(target, project.domain);
  const certificate =
    ownsSite(target, config, project.domain) && domainNames && project.domain
      ? new CertificateStack(app, `${target.prefix}-certificate`, {
          env: certEnv,
          crossRegionReferences: true,
          zoneName: project.domain,
          domainNames: domainNames as [string, ...string[]],
        }).certificate
      : undefined;

  new StatelessStack(app, `${target.prefix}-stateless`, {
    ...common,
    ...(certificate ? { crossRegionReferences: true } : {}),
    prefix: target.prefix,
    config,
    modules: options.modules,
    roomState: stateful.roomState,
    moduleTables: stateful.moduleTables,
    extensions: options.extensions,
    allowedOrigins: allowedOrigins(target, project.domain),
    generatedDir: options.generatedDir,
    site: ownsSite(target, config, project.domain)
      ? { dist: options.siteDist, certificate, domainNames }
      : undefined,
    alertEmail: project.alertEmail,
  });

  return app;
}
