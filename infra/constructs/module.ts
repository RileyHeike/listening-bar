import { ArnFormat, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import type { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import type { IFunction } from 'aws-cdk-lib/aws-lambda';
import { Architecture, Function as LambdaFunction, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import type { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Schedule, ScheduleExpression } from 'aws-cdk-lib/aws-scheduler';
import { LambdaInvoke } from 'aws-cdk-lib/aws-scheduler-targets';
import { Construct } from 'constructs';
import { registry } from '@bar/core';
import { bundling } from '../lib/bundling.ts';
import type { Extension } from '../lib/extensions.ts';
import type { DiscoveredModule } from '../lib/modules.ts';
import type { Realtime } from './realtime.ts';

export interface ModuleConstructProps {
  prefix: string;
  /** Environment kind (BAR_ENV), e.g. "production". */
  barEnv: string;
  module: DiscoveredModule;
  /** The group Lambda serving this module's routes. */
  fn: IFunction;
  table: ITable | undefined;
  roomState: ITable;
  realtime: Realtime;
  extensions: ReadonlyMap<string, Extension>;
  logRetention: RetentionDays;
  retainLogs: boolean;
}

/** Table name env var for a module, e.g. BAR_TABLE_PLANT_CARE. */
export const tableEnvName = (module: string) =>
  `BAR_TABLE_${module.toUpperCase().replace(/-/g, '_')}`;

/**
 * Everything a module manifest asks for, minus the table itself (Stateful):
 * table access, secrets, publish rights for its `emits` domains, scheduled
 * jobs, and named extensions.
 */
export class ModuleConstruct extends Construct {
  readonly jobs = new Map<string, NodejsFunction>();

  constructor(scope: Construct, id: string, props: ModuleConstructProps) {
    super(scope, id);
    const { manifest, dir } = props.module;
    const stack = Stack.of(this);
    const functions: IFunction[] = [props.fn];

    for (const job of manifest.jobs ?? []) {
      const fn = new NodejsFunction(this, `Job-${job.name}`, {
        entry: `${dir}/${job.handler.slice(2)}`,
        runtime: Runtime.NODEJS_24_X,
        architecture: Architecture.ARM_64,
        memorySize: 256,
        timeout: Duration.minutes(1),
        logGroup: new LogGroup(this, `Logs-${job.name}`, {
          retention: props.logRetention,
          removalPolicy: props.retainLogs ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
        }),
        bundling,
        environment: {
          BAR_ENV: props.barEnv,
          SECRETS_PREFIX: props.prefix,
          ROOM_STATE_TABLE: props.roomState.tableName,
          REALTIME_HTTP_HOST: props.realtime.httpHost,
          POWERTOOLS_SERVICE_NAME: `${props.prefix}-${manifest.name}-${job.name}`,
          NODE_OPTIONS: '--enable-source-maps',
        },
      });
      new Schedule(this, `Schedule-${job.name}`, {
        scheduleName: `${props.prefix}-${manifest.name}-${job.name}`,
        schedule: ScheduleExpression.expression(job.schedule),
        target: new LambdaInvoke(fn),
      });
      this.jobs.set(job.name, fn);
      functions.push(fn);
    }

    const addEnvironment = (name: string, value: string) => {
      for (const fn of functions) if (fn instanceof LambdaFunction) fn.addEnvironment(name, value);
    };

    if (props.table) {
      for (const fn of functions) props.table.grantReadWriteData(fn);
      addEnvironment(tableEnvName(manifest.name), props.table.tableName);
    }

    for (const secret of manifest.secrets ?? []) {
      const statement = new PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [
          stack.formatArn({
            service: 'secretsmanager',
            resource: 'secret',
            resourceName: `${props.prefix}/${secret}-*`,
            arnFormat: ArnFormat.COLON_RESOURCE_NAME,
          }),
        ],
      });
      for (const fn of functions) fn.addToRolePolicy(statement);
    }

    const emits = manifest.emits ?? [];
    for (const domain of registry.domainsFor(emits)) {
      const namespace = props.realtime.namespaces.get(domain);
      if (!namespace)
        throw new Error(`Module "${manifest.name}" emits to unknown domain "${domain}".`);
      for (const fn of functions) namespace.grantPublish(fn);
    }
    if (emits.some((type) => registry.get(type).kind === 'state')) {
      for (const fn of functions) props.roomState.grantWriteData(fn);
    }

    for (const { use, options } of manifest.extensions ?? []) {
      const extension = props.extensions.get(use);
      if (!extension) {
        throw new Error(
          `Module "${manifest.name}" uses extension "${use}", which does not exist in infra/extensions.`,
        );
      }
      const parsed = extension.optionsSchema.safeParse(options);
      if (!parsed.success) {
        throw new Error(
          `Module "${manifest.name}": invalid options for extension "${use}": ${parsed.error.message}`,
        );
      }
      extension.apply(this, props.module, parsed.data, {
        prefix: props.prefix,
        fn: props.fn,
        table: props.table,
        addEnvironment,
      });
    }
  }
}
