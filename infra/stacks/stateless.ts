import { CfnOutput, Duration, Stack } from 'aws-cdk-lib';
import type { StackProps } from 'aws-cdk-lib';
import type { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { Alarm, ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';
import type { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import type { Construct } from 'constructs';
import { registry } from '@bar/core';
import { PUBLIC_REALTIME_TOKEN } from '@bar/server/authorizer';
import type { EnvConfig } from '../config/types.ts';
import { Api } from '../constructs/api.ts';
import { Realtime } from '../constructs/realtime.ts';
import { Site } from '../constructs/site.ts';
import type { Extension } from '../lib/extensions.ts';
import type { DiscoveredModule } from '../lib/modules.ts';

export interface StatelessStackProps extends StackProps {
  prefix: string;
  config: EnvConfig;
  modules: readonly DiscoveredModule[];
  roomState: ITable;
  moduleTables: ReadonlyMap<string, ITable>;
  extensions: ReadonlyMap<string, Extension>;
  allowedOrigins: readonly string[];
  generatedDir: string;
  /** Own site (production, staging). */
  site?: {
    dist?: string | undefined;
    certificate?: ICertificate | undefined;
    domainNames?: string[] | undefined;
  };
  alertEmail?: string | undefined;
}

/** Everything replaceable: Lambdas, HTTP API, AppSync Events, site, schedules, alarms. */
export class StatelessStack extends Stack {
  readonly api: Api;
  readonly realtime: Realtime;
  readonly site: Site | undefined;

  constructor(scope: Construct, id: string, props: StatelessStackProps) {
    super(scope, id, props);
    const { prefix, config } = props;

    this.realtime = new Realtime(this, 'Realtime', { prefix, domains: registry.domains });
    this.api = new Api(this, 'Api', {
      prefix,
      config,
      modules: props.modules,
      roomState: props.roomState,
      moduleTables: props.moduleTables,
      realtime: this.realtime,
      allowedOrigins: props.allowedOrigins,
      extensions: props.extensions,
      generatedDir: props.generatedDir,
    });

    const realtimeConfig = {
      httpHost: this.realtime.httpHost,
      realtimeHost: this.realtime.realtimeHost,
      authToken: PUBLIC_REALTIME_TOKEN,
    };

    if (props.site) {
      this.site = new Site(this, 'Site', {
        prefix,
        apiHost: this.api.host,
        certificate: props.site.certificate,
        domainNames: props.site.domainNames,
        retain: config.retainData,
        content: props.site.dist
          ? { dist: props.site.dist, config: { apiBase: '/api', realtime: realtimeConfig } }
          : undefined,
      });
      new CfnOutput(this, 'SiteUrl', {
        value: `https://${this.site.distribution.distributionDomainName}`,
      });
      new CfnOutput(this, 'DistributionId', { value: this.site.distribution.distributionId });
    }

    if (config.alarms) {
      const topic = new Topic(this, 'Alarms', { topicName: `${prefix}-alarms` });
      if (props.alertEmail) topic.addSubscription(new EmailSubscription(props.alertEmail));
      const action = new SnsAction(topic);
      const alarms = [
        new Alarm(this, 'Api5xx', {
          alarmName: `${prefix}-api-5xx`,
          metric: this.api.httpApi.metricServerError({ period: Duration.minutes(5) }),
          threshold: 5,
          evaluationPeriods: 1,
          comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
          treatMissingData: TreatMissingData.NOT_BREACHING,
        }),
        ...[...this.api.functions].map(
          ([group, fn]) =>
            new Alarm(this, `Errors-${group}`, {
              alarmName: `${prefix}-${group}-errors`,
              metric: fn.metricErrors({ period: Duration.minutes(5) }),
              threshold: 3,
              evaluationPeriods: 1,
              comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
              treatMissingData: TreatMissingData.NOT_BREACHING,
            }),
        ),
      ];
      for (const alarm of alarms) alarm.addAlarmAction(action);
    }

    new CfnOutput(this, 'ApiUrl', { value: this.api.httpApi.apiEndpoint });
    new CfnOutput(this, 'RealtimeHttpHost', { value: realtimeConfig.httpHost });
    new CfnOutput(this, 'RealtimeHost', { value: realtimeConfig.realtimeHost });
    new CfnOutput(this, 'RealtimeToken', { value: realtimeConfig.authToken });
  }
}
