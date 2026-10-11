import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { ChannelNamespace } from 'aws-cdk-lib/aws-appsync';
import { AppSyncAuthorizationType, EventApi } from 'aws-cdk-lib/aws-appsync';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import { bundling, repoPath } from '../lib/bundling.ts';

export interface RealtimeProps {
  prefix: string;
  /** Event domains; each becomes a channel namespace. */
  domains: readonly string[];
}

/**
 * AppSync Events API: one channel namespace per event domain. The public
 * connects and subscribes through a Lambda authorizer (no expiring keys);
 * only IAM-signed requests (the backend) may publish.
 */
export class Realtime extends Construct {
  readonly api: EventApi;
  readonly namespaces = new Map<string, ChannelNamespace>();

  constructor(scope: Construct, id: string, props: RealtimeProps) {
    super(scope, id);

    const authorizer = new NodejsFunction(this, 'Authorizer', {
      entry: repoPath('packages/server/src/authorizer.ts'),
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: 128,
      timeout: Duration.seconds(3),
      logGroup: new LogGroup(this, 'AuthorizerLogs', {
        retention: RetentionDays.ONE_WEEK,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      bundling,
    });

    this.api = new EventApi(this, 'Api', {
      apiName: `${props.prefix}-realtime`,
      authorizationConfig: {
        authProviders: [
          { authorizationType: AppSyncAuthorizationType.IAM },
          {
            authorizationType: AppSyncAuthorizationType.LAMBDA,
            lambdaAuthorizerConfig: { handler: authorizer, resultsCacheTtl: Duration.hours(1) },
          },
        ],
        connectionAuthModeTypes: [AppSyncAuthorizationType.LAMBDA, AppSyncAuthorizationType.IAM],
        defaultSubscribeAuthModeTypes: [AppSyncAuthorizationType.LAMBDA],
        defaultPublishAuthModeTypes: [AppSyncAuthorizationType.IAM],
      },
    });

    for (const domain of props.domains) {
      this.namespaces.set(
        domain,
        this.api.addChannelNamespace(`Namespace-${domain}`, {
          channelNamespaceName: domain,
          authorizationConfig: {
            subscribeAuthModeTypes: [AppSyncAuthorizationType.LAMBDA],
            publishAuthModeTypes: [AppSyncAuthorizationType.IAM],
          },
        }),
      );
    }
  }

  get httpHost(): string {
    return this.api.httpDns;
  }

  get realtimeHost(): string {
    return this.api.realtimeDns;
  }
}
