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
   * Shared preview bucket and distribution (from PreviewSiteStack). The
   * preview roles exist only once previews do (they need the domain).
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
 *  - bar-ci-preview (once previews exist): pull requests; can only touch "pr-*" resources. Preview
 *    stacks deploy with CLI credentials and the scoped CloudFormation
 *    execution role bar-ci-preview-exec (`cdk deploy --role-arn …`).
 *
 * The preview policies are deliberately narrow; validate them in the real
 * account when first enabling previews and widen only what CloudFormation
 * proves it needs.
 */
export class CiAccessStack extends Stack {
  readonly releaseRole: Role;
  readonly previewRole: Role | undefined;
  readonly previewExecutionRole: Role | undefined;

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
      assumedBy: github([
        `${repo}:ref:refs/heads/main`,
        `${repo}:environment:staging`,
        `${repo}:environment:production`,
      ]),
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

    const tagged = (tag: string) => ({
      StringEquals: { 'aws:ResourceTag/env': tag },
    });

    new CfnOutput(this, 'ReleaseRoleArn', { value: this.releaseRole.roleArn });

    if (!props.previews) return;
    const previews = props.previews;

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
              sid: 'TaggedServices',
              actions: ['appsync:*', 'apigateway:*'],
              resources: ['*'],
              conditions: {
                'ForAnyValue:StringEquals': {
                  'aws:RequestTag/env': 'preview',
                  'aws:ResourceTag/env': 'preview',
                },
              },
            }),
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
              sid: 'PreviewSiteUpload',
              actions: ['s3:PutObject', 's3:DeleteObject', 's3:GetObject'],
              resources: [`${previews.bucketArn}/pr-*`],
            }),
            new PolicyStatement({
              sid: 'PreviewSiteList',
              actions: ['s3:ListBucket'],
              resources: [previews.bucketArn],
            }),
            new PolicyStatement({
              sid: 'PreviewSiteInvalidate',
              actions: ['cloudfront:CreateInvalidation'],
              resources: [previews.distributionArn],
            }),
            new PolicyStatement({
              sid: 'NoProduction',
              effect: Effect.DENY,
              actions: ['*'],
              resources: ['*'],
              conditions: tagged('production'),
            }),
          ],
        }),
      },
    });

    new CfnOutput(this, 'PreviewRoleArn', { value: this.previewRole.roleArn });
    new CfnOutput(this, 'PreviewExecutionRoleArn', { value: this.previewExecutionRole.roleArn });
  }
}
