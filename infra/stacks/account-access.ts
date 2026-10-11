import { CfnOutput, Duration, Stack } from 'aws-cdk-lib';
import type { StackProps } from 'aws-cdk-lib';
import { CfnBudget } from 'aws-cdk-lib/aws-budgets';
import { AccountPrincipal, PolicyDocument, PolicyStatement, Role } from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

export interface AccountAccessStackProps extends StackProps {
  projectName: string;
  /** Budget alert threshold and recipient. */
  budget: { monthlyUsd: number; email: string };
}

const BOOTSTRAP_QUALIFIER = 'hnb659fds';

/**
 * Account-level access for a personal account (deployed once, by the owner).
 *
 *  - `<project>-developer`: the everyday identity for local work (sandbox
 *    deploys, watch, destroy). It cannot change anything directly; it can
 *    only assume the CDK bootstrap roles (which CloudFormation and CDK use
 *    to deploy) and read logs and stacks. Admin rights stay with the
 *    owner's own sign-in and are needed only for one-time setup.
 *  - A monthly cost budget that emails the owner at 80% of actual spend
 *    and 100% of forecast spend.
 */
export class AccountAccessStack extends Stack {
  readonly developerRole: Role;

  constructor(scope: Construct, id: string, props: AccountAccessStackProps) {
    super(scope, id, props);
    const { account } = this;

    this.developerRole = new Role(this, 'Developer', {
      roleName: `${props.projectName}-developer`,
      description: `Everyday local development for ${props.projectName}: deploys only through CDK bootstrap roles.`,
      // Any identity in this account that is allowed to assume it (the owner's sign-in).
      assumedBy: new AccountPrincipal(account),
      maxSessionDuration: Duration.hours(12),
      inlinePolicies: {
        deploy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              sid: 'DeployThroughCdk',
              actions: ['sts:AssumeRole', 'sts:TagSession'],
              resources: [`arn:aws:iam::${account}:role/cdk-${BOOTSTRAP_QUALIFIER}-*`],
            }),
            new PolicyStatement({
              sid: 'ReadStacksAndBootstrap',
              actions: [
                'cloudformation:DescribeStacks',
                'cloudformation:DescribeStackEvents',
                'cloudformation:ListStacks',
                'cloudformation:GetTemplate',
                'ssm:GetParameter',
              ],
              resources: ['*'],
            }),
            new PolicyStatement({
              sid: 'ReadLogs',
              actions: [
                'logs:DescribeLogGroups',
                'logs:DescribeLogStreams',
                'logs:GetLogEvents',
                'logs:FilterLogEvents',
                'logs:StartLiveTail',
              ],
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    new CfnBudget(this, 'Budget', {
      budget: {
        budgetName: `${props.projectName}-monthly`,
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: props.budget.monthlyUsd, unit: 'USD' },
      },
      notificationsWithSubscribers: [
        { threshold: 80, notificationType: 'ACTUAL' },
        { threshold: 100, notificationType: 'FORECASTED' },
      ].map(({ threshold, notificationType }) => ({
        notification: {
          comparisonOperator: 'GREATER_THAN',
          notificationType,
          threshold,
          thresholdType: 'PERCENTAGE',
        },
        subscribers: [{ subscriptionType: 'EMAIL', address: props.budget.email }],
      })),
    });

    new CfnOutput(this, 'DeveloperRoleArn', { value: this.developerRole.roleArn });
  }
}
