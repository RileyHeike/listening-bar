import { CfnOutput, Duration, Stack } from 'aws-cdk-lib';
import type { StackProps } from 'aws-cdk-lib';
import {
  Effect,
  OidcProviderNative,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
  WebIdentityPrincipal,
} from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

export interface CiAccessStackProps extends StackProps {
  github: GitHubRepository;
  /**
   * Shared preview bucket and distribution (from PreviewSiteStack), once the
   * domain exists. Until then each PR deploys its own site stack.
   */
  previews?: { bucketArn: string; distributionArn: string } | undefined;
}

const GITHUB_OIDC = 'token.actions.githubusercontent.com';

/** A GitHub repository and the permanent numeric ids GitHub puts in OIDC subjects. */
export interface GitHubRepository {
  /** "owner/name" */
  repository: string;
  ownerId: number;
  repositoryId: number;
}

/** GitHub's immutable OIDC subject prefix: "repo:owner@<owner id>/name@<repo id>". */
export function githubSubjectPrefix({
  repository,
  ownerId,
  repositoryId,
}: GitHubRepository): string {
  const [owner, name] = repository.split('/');
  if (!owner || !name)
    throw new Error(`GitHub repository must be "owner/name"; got "${repository}".`);
  return `repo:${owner}@${ownerId}/${name}@${repositoryId}`;
}
const BOOTSTRAP_QUALIFIER = 'hnb659fds';

/**
 * GitHub Actions access via OIDC (no long-lived keys). Deployed once per
 * account, like PreviewSite.
 *
 *  - bar-ci-release: main branch and the staging/production GitHub
 *    Environments; deploys through the CDK bootstrap roles.
 *  - bar-ci-preview: pull requests; can only touch "pr-*" resources. Preview
 *    stacks deploy with CLI credentials and the scoped CloudFormation
 *    execution role bar-ci-preview-exec (`cdk deploy --role-arn …`).
 *
 * The preview policies are deliberately narrow; validate them in the real
 * account when first enabling previews and widen only what CloudFormation
 * proves it needs.
 */
export class CiAccessStack extends Stack {
  readonly releaseRole: Role;
  readonly previewRole: Role;
  readonly previewExecutionRole: Role;

  constructor(scope: Construct, id: string, props: CiAccessStackProps) {
    super(scope, id, props);
    const { account, region } = this;
    // One GitHub OIDC provider per account; other projects' roles can trust it too.
    const provider = new OidcProviderNative(this, 'GitHub', {
      url: `https://${GITHUB_OIDC}`,
      clientIds: ['sts.amazonaws.com'],
    });

    const github = (subjects: string[]) =>
      new WebIdentityPrincipal(provider.oidcProviderArn, {
        StringEquals: { [`${GITHUB_OIDC}:aud`]: 'sts.amazonaws.com' },
        StringLike: { [`${GITHUB_OIDC}:sub`]: subjects },
      });

    const repo = githubSubjectPrefix(props.github);
    const assetsBucket = `arn:aws:s3:::cdk-${BOOTSTRAP_QUALIFIER}-assets-${account}-${region}`;
    const named = (service: string, resource: string) =>
      `arn:aws:${service}:${region}:${account}:${resource}`;

    this.releaseRole = new Role(this, 'Release', {
      roleName: 'bar-ci-release',
      // Only jobs in the staging/production GitHub Environments (main only,
      // production approval-gated). Not every job on main: issue-triggered
      // agent jobs run on main too.
      assumedBy: github([`${repo}:environment:staging`, `${repo}:environment:production`]),
      maxSessionDuration: Duration.hours(2),
      inlinePolicies: {
        cdk: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: ['sts:AssumeRole'],
              resources: [`arn:aws:iam::${account}:role/cdk-${BOOTSTRAP_QUALIFIER}-*`],
            }),
          ],
        }),
      },
    });

    new CfnOutput(this, 'ReleaseRoleArn', { value: this.releaseRole.roleArn });

    /** Never touch other environments' resources (tagged env=…), including people's sandboxes. */
    const protectShared = new PolicyStatement({
      sid: 'ProtectSharedEnvironments',
      effect: Effect.DENY,
      actions: ['*'],
      resources: ['*'],
      conditions: {
        StringEquals: { 'aws:ResourceTag/env': ['production', 'staging', 'sandbox', 'account'] },
      },
    });

    this.previewExecutionRole = new Role(this, 'PreviewExecution', {
      roleName: 'bar-ci-preview-exec',
      assumedBy: new ServicePrincipal('cloudformation.amazonaws.com'),
      inlinePolicies: {
        preview: new PolicyDocument({
          statements: [
            new PolicyStatement({
              sid: 'NamedPreviewResources',
              actions: ['dynamodb:*', 'lambda:*', 'logs:*', 'scheduler:*', 'sns:*'],
              resources: [
                named('dynamodb', 'table/pr-*'),
                named('lambda', 'function:pr-*'),
                named('logs', 'log-group:/aws/lambda/pr-*'),
                named('logs', 'log-group:/aws/lambda/pr-*:*'),
                // Generated names start with the stack name (API access logs, authorizer logs).
                named('logs', 'log-group:pr-*'),
                named('logs', 'log-group:pr-*:*'),
                named('scheduler', 'schedule/default/pr-*'),
                named('sns', 'pr-*'),
              ],
            }),
            new PolicyStatement({
              sid: 'PreviewRoles',
              actions: [
                'iam:*Role',
                'iam:*RolePolicy',
                'iam:*RolePolicies',
                'iam:PassRole',
                'iam:TagRole',
                'iam:UntagRole',
              ],
              resources: [`arn:aws:iam::${account}:role/pr-*`],
            }),
            new PolicyStatement({
              sid: 'PreviewBuckets',
              actions: ['s3:*'],
              resources: ['arn:aws:s3:::pr-*', 'arn:aws:s3:::pr-*/*'],
            }),
            new PolicyStatement({
              // These services name resources by random id, so they cannot be
              // scoped by name; shared environments are protected by tag below.
              sid: 'IdNamedServices',
              actions: [
                'appsync:*',
                'apigateway:*',
                'cloudfront:*Distribution*',
                'cloudfront:*OriginAccessControl*',
                'cloudfront:CreateInvalidation',
                'cloudfront:GetInvalidation',
                'cloudfront:TagResource',
                'cloudfront:UntagResource',
                'cloudfront:ListTagsForResource',
                'cloudfront:GetResponseHeadersPolicy',
                'cloudfront:GetCachePolicy',
                'cloudfront:GetOriginRequestPolicy',
              ],
              resources: ['*'],
            }),
            new PolicyStatement({
              sid: 'PreviewFunctions',
              actions: ['cloudfront:*Function*'],
              resources: [`arn:aws:cloudfront::${account}:function/pr-*`],
            }),
            new PolicyStatement({
              // CDK's BucketDeployment publishes an AWS CLI layer with a generated name.
              sid: 'LambdaLayers',
              actions: [
                'lambda:PublishLayerVersion',
                'lambda:GetLayerVersion',
                'lambda:DeleteLayerVersion',
              ],
              resources: [named('lambda', 'layer:*')],
            }),
            protectShared,
            new PolicyStatement({
              sid: 'BootstrapReads',
              actions: ['s3:GetObject', 'ssm:GetParameters', 'ssm:GetParameter'],
              resources: [
                `${assetsBucket}/*`,
                named('ssm', `parameter/cdk-bootstrap/${BOOTSTRAP_QUALIFIER}/*`),
              ],
            }),
          ],
        }),
      },
    });

    this.previewRole = new Role(this, 'Preview', {
      roleName: 'bar-ci-preview',
      assumedBy: github([`${repo}:pull_request`]),
      maxSessionDuration: Duration.hours(2),
      inlinePolicies: {
        preview: new PolicyDocument({
          statements: [
            new PolicyStatement({
              sid: 'PreviewStacks',
              actions: ['cloudformation:*'],
              resources: [named('cloudformation', 'stack/pr-*/*')],
            }),
            new PolicyStatement({
              sid: 'ReadOnlyCloudFormation',
              actions: [
                'cloudformation:DescribeStacks',
                'cloudformation:ListStacks',
                'cloudformation:ValidateTemplate',
                'cloudformation:GetTemplateSummary',
              ],
              resources: ['*'],
            }),
            new PolicyStatement({
              sid: 'PassExecutionRole',
              actions: ['iam:PassRole'],
              resources: [this.previewExecutionRole.roleArn],
            }),
            new PolicyStatement({
              sid: 'Assets',
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:ListBucket',
                's3:GetBucketLocation',
                'ssm:GetParameter',
              ],
              resources: [
                assetsBucket,
                `${assetsBucket}/*`,
                named('ssm', `parameter/cdk-bootstrap/${BOOTSTRAP_QUALIFIER}/*`),
              ],
            }),
            new PolicyStatement({
              sid: 'ReadPreviewLogs',
              actions: ['logs:FilterLogEvents', 'logs:GetLogEvents', 'logs:DescribeLogStreams'],
              resources: [
                named('logs', 'log-group:/aws/lambda/pr-*:*'),
                named('logs', 'log-group:pr-*:*'),
              ],
            }),
            new PolicyStatement({
              // Lets CDK name the exact action when a deploy is denied.
              sid: 'DiagnoseDeploys',
              actions: ['cloudtrail:LookupEvents'],
              resources: ['*'],
            }),
            ...(props.previews
              ? [
                  new PolicyStatement({
                    sid: 'PreviewSiteUpload',
                    actions: ['s3:PutObject', 's3:DeleteObject', 's3:GetObject'],
                    resources: [`${props.previews.bucketArn}/pr-*`],
                  }),
                  new PolicyStatement({
                    sid: 'PreviewSiteList',
                    actions: ['s3:ListBucket'],
                    resources: [props.previews.bucketArn],
                  }),
                  new PolicyStatement({
                    sid: 'PreviewSiteInvalidate',
                    actions: ['cloudfront:CreateInvalidation'],
                    resources: [props.previews.distributionArn],
                  }),
                ]
              : []),
            protectShared,
          ],
        }),
      },
    });

    new CfnOutput(this, 'PreviewRoleArn', { value: this.previewRole.roleArn });
    new CfnOutput(this, 'PreviewExecutionRoleArn', { value: this.previewExecutionRole.roleArn });
  }
}
