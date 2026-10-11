import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import type { StackProps } from 'aws-cdk-lib';
import { CfnBudget } from 'aws-cdk-lib/aws-budgets';
import type { Attribute, ITable } from 'aws-cdk-lib/aws-dynamodb';
import { AttributeType, BillingMode, Table, TableEncryption } from 'aws-cdk-lib/aws-dynamodb';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';
import type { EnvConfig } from '../config/types.ts';
import type { DiscoveredModule } from '../lib/modules.ts';

export interface StatefulStackProps extends StackProps {
  prefix: string;
  config: EnvConfig;
  modules: readonly DiscoveredModule[];
  /** Account-wide budget alert (created with production only). */
  budget?: { monthlyUsd: number; email: string } | undefined;
}

const keyAttribute = (key: { name: string; type: 'S' | 'N' }): Attribute => ({
  name: key.name,
  type: key.type === 'S' ? AttributeType.STRING : AttributeType.NUMBER,
});

/** Data that must outlive deploys: room-state, module tables, media. */
export class StatefulStack extends Stack {
  readonly roomState: ITable;
  readonly moduleTables = new Map<string, ITable>();
  readonly media: Bucket;

  constructor(scope: Construct, id: string, props: StatefulStackProps) {
    super(scope, id, { ...props, terminationProtection: props.config.terminationProtection });
    const { prefix, config } = props;
    const removalPolicy = config.retainData ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;
    const tableDefaults = {
      billingMode: BillingMode.PAY_PER_REQUEST,
      encryption: TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: config.pointInTimeRecovery },
      deletionProtection: config.retainData,
      removalPolicy,
    };

    this.roomState = new Table(this, 'RoomState', {
      ...tableDefaults,
      tableName: `${prefix}-room-state`,
      partitionKey: { name: 'type', type: AttributeType.STRING },
    });

    for (const { manifest } of props.modules) {
      if (!manifest.table) continue;
      const table = new Table(this, `Table-${manifest.name}`, {
        ...tableDefaults,
        tableName: `${prefix}-${manifest.name}`,
        partitionKey: keyAttribute(manifest.table.partitionKey),
        ...(manifest.table.sortKey ? { sortKey: keyAttribute(manifest.table.sortKey) } : {}),
        ...(manifest.table.ttlAttribute
          ? { timeToLiveAttribute: manifest.table.ttlAttribute }
          : {}),
      });
      for (const index of manifest.table.indexes ?? []) {
        table.addGlobalSecondaryIndex({
          indexName: index.name,
          partitionKey: keyAttribute(index.partitionKey),
          ...(index.sortKey ? { sortKey: keyAttribute(index.sortKey) } : {}),
        });
      }
      this.moduleTables.set(manifest.name, table);
    }

    this.media = new Bucket(this, 'Media', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: config.retainData,
      removalPolicy,
      autoDeleteObjects: !config.retainData,
    });

    if (props.budget) {
      const { email } = props.budget;
      new CfnBudget(this, 'Budget', {
        budget: {
          budgetName: `${prefix}-monthly`,
          budgetType: 'COST',
          timeUnit: 'MONTHLY',
          budgetLimit: { amount: props.budget.monthlyUsd, unit: 'USD' },
        },
        notificationsWithSubscribers: [80, 100].map((threshold) => ({
          notification: {
            comparisonOperator: 'GREATER_THAN',
            notificationType: threshold === 100 ? 'FORECASTED' : 'ACTUAL',
            threshold,
            thresholdType: 'PERCENTAGE',
          },
          subscribers: [{ subscriptionType: 'EMAIL', address: email }],
        })),
      });
    }
  }
}
