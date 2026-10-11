import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { CorsHttpMethod, HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import type { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import type { EnvConfig } from '../config/types.ts';
import { bundling } from '../lib/bundling.ts';
import { writeGroupEntry } from '../lib/entries.ts';
import type { Extension } from '../lib/extensions.ts';
import type { DiscoveredModule } from '../lib/modules.ts';
import { assignGroups } from '../lib/modules.ts';
import { ModuleConstruct } from './module.ts';
import type { Realtime } from './realtime.ts';

export interface ApiProps {
  prefix: string;
  config: EnvConfig;
  modules: readonly DiscoveredModule[];
  roomState: ITable;
  moduleTables: ReadonlyMap<string, ITable>;
  realtime: Realtime;
  /** Origins allowed to call the API cross-origin (previews, local dev). */
  allowedOrigins: readonly string[];
  extensions: ReadonlyMap<string, Extension>;
  /** Where generated Lambda entries are written. */
  generatedDir: string;
}

/**
 * HTTP API with one Lambda per group (infra/config/<env>.ts). Each module
 * is mounted at /api/<name>; platform routes at /api/room. Grants are
 * least-privilege per group, derived from the modules it serves.
 */
export class Api extends Construct {
  readonly httpApi: HttpApi;
  readonly functions = new Map<string, NodejsFunction>();

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);
    const { prefix, config, realtime } = props;
    const names = props.modules.map((m) => m.manifest.name);
    const groups = assignGroups(config.lambdaGroups, names);

    this.httpApi = new HttpApi(this, 'Http', {
      apiName: `${prefix}-api`,
      corsPreflight:
        props.allowedOrigins.length > 0
          ? {
              allowOrigins: [...props.allowedOrigins],
              allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST, CorsHttpMethod.OPTIONS],
              allowHeaders: ['content-type'],
              maxAge: Duration.hours(1),
            }
          : undefined,
    });

    const integrations = new Map<string, HttpLambdaIntegration>();
    for (const [group, members] of groups.members) {
      const modules = props.modules.filter((m) => members.includes(m.manifest.name));
      const fn = new NodejsFunction(this, `Group-${group}`, {
        entry: writeGroupEntry(props.generatedDir, `${prefix}-${group}`, modules),
        runtime: Runtime.NODEJS_24_X,
        architecture: Architecture.ARM_64,
        memorySize: 512,
        timeout: Duration.seconds(10),
        logGroup: new LogGroup(this, `Logs-${group}`, {
          retention: config.retainData ? RetentionDays.THREE_MONTHS : RetentionDays.ONE_WEEK,
          removalPolicy: config.retainData ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
        }),
        bundling,
        environment: {
          BAR_ENV: config.kind,
          ROOM_STATE_TABLE: props.roomState.tableName,
          REALTIME_HTTP_HOST: realtime.httpHost,
          DEV_ROUTES: config.devRoutes ? 'enabled' : 'disabled',
          ALLOWED_ORIGINS: props.allowedOrigins.join(','),
          SECRETS_PREFIX: prefix,
          POWERTOOLS_SERVICE_NAME: `${prefix}-${group}`,
          NODE_OPTIONS: '--enable-source-maps',
        },
      });
      this.functions.set(group, fn);
      integrations.set(group, new HttpLambdaIntegration(`Integration-${group}`, fn));
    }

    const integrationFor = (group: string) => {
      const integration = integrations.get(group);
      if (!integration) throw new Error(`No Lambda for group "${group}".`);
      return integration;
    };
    const route = (path: string, group: string) => {
      this.httpApi.addRoutes({
        path,
        methods: [HttpMethod.ANY],
        integration: integrationFor(group),
      });
    };

    // Platform routes, plus the catch-all so unknown paths get the API's JSON 404.
    route('/api/room/{proxy+}', groups.platform);
    route('/api/{proxy+}', groups.platform);
    const platform = this.functions.get(groups.platform);
    if (platform) {
      props.roomState.grantReadData(platform);
      if (config.devRoutes) {
        // The dev publish route can publish any registered event.
        props.roomState.grantWriteData(platform);
        for (const namespace of realtime.namespaces.values()) namespace.grantPublish(platform);
      }
    }

    for (const module of props.modules) {
      const group = groups.byModule.get(module.manifest.name) ?? groups.platform;
      const fn = this.functions.get(group);
      if (!fn) continue;
      if (module.manifest.routes) {
        route(`/api/${module.manifest.name}`, group);
        route(`/api/${module.manifest.name}/{proxy+}`, group);
      }
      new ModuleConstruct(this, `Module-${module.manifest.name}`, {
        prefix,
        barEnv: config.kind,
        module,
        fn,
        table: props.moduleTables.get(module.manifest.name),
        roomState: props.roomState,
        realtime,
        extensions: props.extensions,
        logRetention: config.retainData ? RetentionDays.THREE_MONTHS : RetentionDays.ONE_WEEK,
        retainLogs: config.retainData,
      });
    }
  }

  /** API Gateway host, for CloudFront's /api/* origin. */
  get host(): string {
    return `${this.httpApi.apiId}.execute-api.${Stack.of(this).region}.amazonaws.com`;
  }
}
