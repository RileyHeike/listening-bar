import { Match } from 'aws-cdk-lib/assertions';
import { registry } from '@bar/core';
import { describe, expect, it } from 'vitest';
import { assignGroups, discoverModules } from '../lib/modules.ts';
import { resolveTarget } from '../lib/naming.ts';
import { fixtureModulesDir, synth } from './helpers.ts';

interface Statement {
  Action: string | string[];
  Resource: unknown;
  Effect: string;
}

/** Every IAM statement in a template, flattened. */
function statements(
  template: ReturnType<Awaited<ReturnType<typeof synth>>['template']>,
): Statement[] {
  return Object.values(template.findResources('AWS::IAM::Policy')).flatMap(
    (policy) =>
      (policy as { Properties: { PolicyDocument: { Statement: Statement[] } } }).Properties
        .PolicyDocument.Statement,
  );
}
const actions = (all: Statement[]) =>
  all.flatMap((s) => (Array.isArray(s.Action) ? s.Action : [s.Action]));

describe('naming', () => {
  it('prefixes every environment', () => {
    expect(resolveTarget({ env: 'production' }).prefix).toBe('prod');
    expect(resolveTarget({ env: 'staging' }).prefix).toBe('staging');
    expect(resolveTarget({ env: 'preview', pr: '12' }).prefix).toBe('pr-12');
    expect(resolveTarget({ env: 'sandbox', user: 'Riley Heike' }).prefix).toBe('dev-riley-heike');
  });

  it('refuses incomplete targets', () => {
    expect(() => resolveTarget({ env: 'preview' })).toThrow(/pr=/);
    expect(() => resolveTarget({ env: 'sandbox' })).toThrow(/user=/);
    expect(() => resolveTarget({ env: 'prod' })).toThrow(/Unknown -c env=prod/);
  });

  it('names stacks and tables with the prefix, and tags everything', async () => {
    const { assembly, template } = await synth({ env: 'preview', pr: '7' });
    expect(assembly.stacks.map((s) => s.stackName).sort()).toEqual([
      'pr-7-stateful',
      'pr-7-stateless',
    ]);
    template('pr-7-stateful').hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'pr-7-room-state',
      Tags: Match.arrayWith([
        { Key: 'env', Value: 'preview' },
        { Key: 'prefix', Value: 'pr-7' },
        { Key: 'project', Value: 'listening-bar' },
      ]),
    });
  });
});

describe('safeguards', () => {
  it('production keeps data: RETAIN, PITR, deletion and termination protection', async () => {
    const { assembly, template } = await synth({ env: 'production' });
    const stateful = template('prod-stateful');
    stateful.hasResource('AWS::DynamoDB::Table', {
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
      Properties: Match.objectLike({
        DeletionProtectionEnabled: true,
        PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
      }),
    });
    stateful.hasResource('AWS::S3::Bucket', { DeletionPolicy: 'Retain' });
    expect(assembly.getStackByName('prod-stateful').terminationProtection).toBe(true);
  });

  it('previews and sandboxes clean up after themselves', async () => {
    const { assembly, template } = await synth({ env: 'sandbox', user: 'riley' });
    template('dev-riley-stateful').hasResource('AWS::DynamoDB::Table', {
      DeletionPolicy: 'Delete',
      Properties: Match.objectLike({
        PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: false },
      }),
    });
    expect(assembly.getStackByName('dev-riley-stateful').terminationProtection).toBeFalsy();
  });

  it('never enables dev routes or dev publish rights in production', async () => {
    const prod = (await synth({ env: 'production' })).template('prod-stateless');
    prod.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({ DEV_ROUTES: 'disabled', BAR_ENV: 'production' }),
      },
    });
    const prodActions = actions(statements(prod));
    expect(prodActions).not.toContain('appsync:EventPublish');
    expect(prodActions).not.toContain('dynamodb:PutItem');

    const sandbox = (await synth({ env: 'sandbox', user: 'riley' })).template(
      'dev-riley-stateless',
    );
    sandbox.hasResourceProperties('AWS::Lambda::Function', {
      Environment: { Variables: Match.objectLike({ DEV_ROUTES: 'enabled' }) },
    });
    expect(actions(statements(sandbox))).toContain('appsync:EventPublish');
  });

  it('alarms on API 5xx and Lambda errors in production only', async () => {
    (await synth({ env: 'production' }))
      .template('prod-stateless')
      .resourceCountIs('AWS::CloudWatch::Alarm', 2);
    (await synth({ env: 'staging' }))
      .template('staging-stateless')
      .resourceCountIs('AWS::CloudWatch::Alarm', 0);
  });
});

describe('real-time', () => {
  it('has one namespace per event domain: public subscribe, IAM-only publish', async () => {
    const template = (await synth({ env: 'staging' })).template('staging-stateless');
    template.resourceCountIs('AWS::AppSync::ChannelNamespace', registry.domains.length);
    for (const domain of registry.domains) {
      template.hasResourceProperties('AWS::AppSync::ChannelNamespace', {
        Name: domain,
        SubscribeAuthModes: [{ AuthType: 'AWS_LAMBDA' }],
        PublishAuthModes: [{ AuthType: 'AWS_IAM' }],
      });
    }
    template.hasResourceProperties('AWS::AppSync::Api', {
      EventConfig: Match.objectLike({ DefaultPublishAuthModes: [{ AuthType: 'AWS_IAM' }] }),
    });
  });
});

describe('site', () => {
  it('production and staging get CloudFront with /api/* on the same origin', async () => {
    const template = (await synth({ env: 'production' })).template('prod-stateless');
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        CacheBehaviors: [Match.objectLike({ PathPattern: '/api/*' })],
        CustomErrorResponses: Match.arrayWith([
          Match.objectLike({ ErrorCode: 404, ResponsePagePath: '/404.html' }),
        ]),
      }),
    });
  });

  it('gives each preview its own site until the domain exists', async () => {
    (await synth({ env: 'preview', pr: '3' }))
      .template('pr-3-stateless')
      .hasResourceProperties('AWS::CloudFront::Function', { Name: 'pr-3-directory-index' });
    (await synth({ env: 'preview', pr: '3' }, { project: { domain: 'example.com' } }))
      .template('pr-3-stateless')
      .resourceCountIs('AWS::CloudFront::Distribution', 0);
    (await synth({ env: 'sandbox', user: 'riley' }))
      .template('dev-riley-stateless')
      .resourceCountIs('AWS::CloudFront::Distribution', 0);
  });

  it('uses AWS-managed security headers, so environments cannot alter each other', async () => {
    const template = (await synth({ env: 'production' })).template('prod-stateless');
    template.resourceCountIs('AWS::CloudFront::ResponseHeadersPolicy', 0);
  });

  it('previews allow their own origin through CORS', async () => {
    const { template } = await synth(
      { env: 'preview', pr: '3' },
      { project: { domain: 'example.com' } },
    );
    template('pr-3-stateless').hasResourceProperties('AWS::ApiGatewayV2::Api', {
      CorsConfiguration: Match.objectLike({ AllowOrigins: ['https://pr-3.preview.example.com'] }),
    });
  });
});

describe('modules', () => {
  it('discovers and validates module manifests', async () => {
    const modules = await discoverModules(fixtureModulesDir);
    expect(modules.map((m) => m.manifest.name)).toEqual(['plant-care']);
  });

  it('turns a manifest into table, routes, grants, jobs and extensions', async () => {
    const { template } = await synth({ env: 'staging' }, { withModules: true });
    template('staging-stateful').hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'staging-plant-care',
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' },
      ],
      GlobalSecondaryIndexes: [Match.objectLike({ IndexName: 'byDate' })],
      TimeToLiveSpecification: { AttributeName: 'expiresAt', Enabled: true },
    });

    const stateless = template('staging-stateless');
    for (const routeKey of [
      'ANY /api/plant-care',
      'ANY /api/plant-care/{proxy+}',
      'ANY /api/room/{proxy+}',
    ]) {
      stateless.hasResourceProperties('AWS::ApiGatewayV2::Route', { RouteKey: routeKey });
    }
    stateless.hasResourceProperties('AWS::Scheduler::Schedule', {
      Name: 'staging-plant-care-water',
      ScheduleExpression: 'rate(1 day)',
    });
    stateless.hasResourceProperties('AWS::SQS::Queue', { QueueName: 'staging-plant-care' });
    stateless.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          BAR_ENV: 'staging',
          POWERTOOLS_SERVICE_NAME: 'staging-plant-care-water',
          REALTIME_HTTP_HOST: Match.anyValue(),
        }),
      },
    });
    stateless.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          BAR_TABLE_PLANT_CARE: Match.anyValue(),
          QUEUE_URL: Match.anyValue(),
        }),
      },
    });

    const all = statements(stateless);
    const secret = all.find((s) => actions([s]).includes('secretsmanager:GetSecretValue'));
    expect(JSON.stringify(secret?.Resource)).toContain(':secret:staging/sensor-token-*');
    // Publish rights only for the domain it emits (weather), on that namespace.
    const publish = all.filter((s) => actions([s]).includes('appsync:EventPublish'));
    expect(publish.length).toBeGreaterThan(0);
    expect(JSON.stringify(publish)).toContain('weather');
    expect(JSON.stringify(publish)).not.toContain('Namespacemusic');
  });

  it('fails clearly on an unknown extension or bad options', async () => {
    await expect(
      synth({ env: 'staging' }, { withModules: true, extensions: new Map() }),
    ).rejects.toThrow(/extension "queue", which does not exist/);
  });

  it('can split modules into their own Lambda groups', async () => {
    const { template } = await synth(
      { env: 'staging' },
      { withModules: true, config: { lambdaGroups: { api: ['*'], plants: ['plant-care'] } } },
    );
    const functions = template('staging-stateless').findResources('AWS::Lambda::Function', {
      Properties: {
        Environment: { Variables: Match.objectLike({ POWERTOOLS_SERVICE_NAME: Match.anyValue() }) },
      },
    });
    const services = Object.values(functions).map(
      (f) =>
        (f as { Properties: { Environment: { Variables: Record<string, string> } } }).Properties
          .Environment.Variables.POWERTOOLS_SERVICE_NAME,
    );
    expect(services).toEqual(expect.arrayContaining(['staging-api', 'staging-plants']));
  });

  it('assigns platform routes to the "*" group unless a group lists "room"', () => {
    expect(assignGroups({ api: ['*'] }, ['a']).platform).toBe('api');
    expect(assignGroups({ api: ['*'], platform: ['room'] }, ['a']).platform).toBe('platform');
    expect(() => assignGroups({ only: ['a'] }, ['a', 'b'])).toThrow(/no "\*" group/);
  });
});

describe('account access', () => {
  it('creates a deploy-only developer role and an emailed budget', async () => {
    const { template } = await synth(
      { env: 'account' },
      { project: { alertEmail: 'owner@example.com' } },
    );
    const access = template('account-access');
    const roles = access.findResources('AWS::IAM::Role', {
      Properties: { RoleName: 'listening-bar-developer' },
    });
    const role = JSON.stringify(Object.values(roles)[0]);
    expect(role).toContain('role/cdk-hnb659fds-*');
    // Deploys go through CDK's roles; the developer role cannot create or change resources itself.
    expect(role).not.toMatch(/"Action":"(\*|iam:\*|s3:\*|lambda:\*|dynamodb:\*)"/);
    access.hasResourceProperties('AWS::Budgets::Budget', {
      Budget: Match.objectLike({ CostFilters: { TagKeyValue: ['user:project$listening-bar'] } }),
      NotificationsWithSubscribers: Match.arrayWith([
        Match.objectLike({
          Subscribers: [{ SubscriptionType: 'EMAIL', Address: 'owner@example.com' }],
        }),
      ]),
    });
  });

  it('pins every stack to the project account and refuses other credentials', async () => {
    const { assembly } = await synth({ env: 'staging' });
    expect(assembly.stacks.every((stack) => stack.environment.account === '111111111111')).toBe(
      true,
    );
    await expect(synth({ env: 'staging' }, { account: '222222222222' })).rejects.toThrow(
      /deploys only to 111111111111/,
    );
  });
});

describe('account stacks', () => {
  it('skip the preview site and CI access until a domain and repository are set', async () => {
    const { assembly } = await synth({ env: 'account' });
    expect(assembly.stacks).toEqual([]);
  });

  it('give CI release and preview access before there is a domain', async () => {
    const { assembly, template } = await synth(
      { env: 'account' },
      { project: { github: { repository: 'owner/listening-bar', ownerId: 1, repositoryId: 2 } } },
    );
    expect(assembly.stacks.map((s) => s.stackName)).toEqual(['account-ci-access']);
    const ci = template('account-ci-access');
    const roles = ci.findResources('AWS::IAM::Role');
    const names = Object.values(roles).map(
      (r) => (r as { Properties: { RoleName?: string } }).Properties.RoleName,
    );
    expect(names.sort()).toEqual(['bar-ci-preview', 'bar-ci-preview-exec', 'bar-ci-release']);
    expect(JSON.stringify(roles)).toContain('repo:owner@1/listening-bar@2:environment:production');
    const release = JSON.stringify(
      Object.values(roles).find(
        (r) =>
          (r as { Properties: { RoleName?: string } }).Properties.RoleName === 'bar-ci-release',
      ),
    );
    // Agent jobs triggered by issues run on main; only the deploy environments may release.
    expect(release).not.toContain('refs/heads/main');
    ci.resourceCountIs('AWS::IAM::OIDCProvider', 1);
    ci.resourceCountIs('AWS::Lambda::Function', 0);
  });

  it('let previews manage their own resources but never other environments', async () => {
    const { template } = await synth(
      { env: 'account' },
      { project: { github: { repository: 'owner/listening-bar', ownerId: 1, repositoryId: 2 } } },
    );
    const roles = template('account-ci-access').findResources('AWS::IAM::Role');
    const json = JSON.stringify(roles);
    for (const role of ['bar-ci-preview', 'bar-ci-preview-exec']) {
      const policy = JSON.stringify(
        Object.values(roles).find(
          (r) => (r as { Properties: { RoleName?: string } }).Properties.RoleName === role,
        ),
      );
      expect(policy, role).toContain('"Sid":"ProtectSharedEnvironments"');
      expect(policy, role).toMatch(
        /"aws:ResourceTag\/env":\["production","staging","sandbox","account"\]/,
      );
    }
    expect(json).toContain(':function/pr-*');
    expect(json).toContain(':log-group:pr-*');
    expect(json).toContain('cloudtrail:LookupEvents');
    expect(json).toContain('"Sid":"IdNamedServices"');
  });

  it('scope the preview CI role to pr-* stacks and pull requests', async () => {
    const { template } = await synth(
      { env: 'account' },
      {
        project: {
          domain: 'example.com',
          github: { repository: 'owner/listening-bar', ownerId: 1, repositoryId: 2 },
        },
      },
    );
    const roles = template('account-ci-access').findResources('AWS::IAM::Role', {
      Properties: { RoleName: 'bar-ci-preview' },
    });
    const role = JSON.stringify(Object.values(roles)[0]);
    expect(role).toContain('"repo:owner@1/listening-bar@2:pull_request"');
    expect(role).not.toContain('refs/heads/main');
    expect(role).toContain(':stack/pr-*/*');
    expect(role).not.toMatch(/"cloudformation:\*"[^\]]*"Resource":"\*"/);
    template('account-preview-site').resourceCountIs('AWS::CloudFront::Distribution', 1);
  });
});
