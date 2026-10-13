import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import type { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  Function as CloudFrontFunction,
  FunctionCode,
  FunctionEventType,
  FunctionRuntime,
  OriginRequestPolicy,
  ResponseHeadersPolicy,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { HttpOrigin, S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, CacheControl, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export interface SiteProps {
  prefix: string;
  /** API Gateway host; CloudFront routes /api/* to it (same origin as the site). */
  apiHost: string;
  certificate?: ICertificate | undefined;
  domainNames?: string[] | undefined;
  /** Built site (apps/web/dist) and the runtime config to publish with it. */
  content?: { dist: string; config: Record<string, unknown> } | undefined;
  retain: boolean;
}

/** Map "/workshop" and "/workshop/" to "/workshop/index.html" (Astro directory output). */
export const DIRECTORY_INDEX_FUNCTION = `function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.endsWith('/')) {
    request.uri = uri + 'index.html';
  } else if (uri.split('/').pop().indexOf('.') === -1) {
    request.uri = uri + '/index.html';
  }
  return request;
}`;

/** Static site on S3 behind CloudFront, with /api/* on the same origin. */
export class Site extends Construct {
  readonly bucket: Bucket;
  readonly distribution: Distribution;

  constructor(scope: Construct, id: string, props: SiteProps) {
    super(scope, id);

    this.bucket = new Bucket(this, 'Bucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: props.retain ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: !props.retain,
    });

    const directoryIndex = new CloudFrontFunction(this, 'DirectoryIndex', {
      // Env-prefixed so the preview CI role can be scoped to "pr-*" functions.
      functionName: `${props.prefix}-directory-index`,
      runtime: FunctionRuntime.JS_2_0,
      code: FunctionCode.fromInline(DIRECTORY_INDEX_FUNCTION),
    });

    // AWS-managed security headers (HSTS, nosniff, frame options, referrer
    // policy). Managed, so no environment can change another's.
    const headers = ResponseHeadersPolicy.SECURITY_HEADERS;

    this.distribution = new Distribution(this, 'Distribution', {
      comment: `${props.prefix} site`,
      defaultRootObject: 'index.html',
      ...(props.certificate && props.domainNames
        ? { certificate: props.certificate, domainNames: props.domainNames }
        : {}),
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
        responseHeadersPolicy: headers,
        functionAssociations: [
          { function: directoryIndex, eventType: FunctionEventType.VIEWER_REQUEST },
        ],
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new HttpOrigin(props.apiHost),
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: AllowedMethods.ALLOW_ALL,
          cachePolicy: CachePolicy.CACHING_DISABLED,
          originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          responseHeadersPolicy: headers,
        },
      },
      errorResponses: [403, 404].map((status) => ({
        httpStatus: status,
        responseHttpStatus: 404,
        responsePagePath: '/404.html',
        ttl: Duration.minutes(1),
      })),
    });

    if (props.content) {
      // Hashed assets: immutable, never pruned (open tabs may still need them).
      new BucketDeployment(this, 'Assets', {
        sources: [Source.asset(`${props.content.dist}/_astro`)],
        destinationBucket: this.bucket,
        destinationKeyPrefix: '_astro/',
        prune: false,
        cacheControl: [CacheControl.fromString('public, max-age=31536000, immutable')],
      });
      // Pages and config: always revalidated.
      new BucketDeployment(this, 'Pages', {
        sources: [
          Source.asset(props.content.dist, { exclude: ['_astro/**'] }),
          Source.jsonData('config.json', props.content.config),
        ],
        destinationBucket: this.bucket,
        exclude: ['_astro/*'],
        cacheControl: [CacheControl.fromString('public, max-age=0, must-revalidate')],
        distribution: this.distribution,
        distributionPaths: ['/*'],
      });
    }
  }
}
