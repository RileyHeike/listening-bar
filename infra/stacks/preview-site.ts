import { CfnOutput, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import type { StackProps } from 'aws-cdk-lib';
import type { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import {
  Distribution,
  Function as CloudFrontFunction,
  FunctionCode,
  FunctionEventType,
  FunctionRuntime,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

export interface PreviewSiteStackProps extends StackProps {
  domain: string;
  certificate: ICertificate;
}

/**
 * Maps "pr-12.preview.<domain>/path" to "/pr-12/path/index.html" in the
 * shared bucket. Each PR uploads its build (and /config.json) under its prefix.
 */
export const PREVIEW_ROUTER_FUNCTION = `function handler(event) {
  var request = event.request;
  var host = request.headers.host ? request.headers.host.value : '';
  var match = host.match(/^(pr-[0-9]+)\\./);
  if (!match) {
    return { statusCode: 404, statusDescription: 'Not Found' };
  }
  var uri = request.uri;
  if (uri.endsWith('/')) {
    uri = uri + 'index.html';
  } else if (uri.split('/').pop().indexOf('.') === -1) {
    uri = uri + '/index.html';
  }
  request.uri = '/' + match[1] + uri;
  return request;
}`;

/** One long-lived distribution serving every PR preview (deployed once). */
export class PreviewSiteStack extends Stack {
  readonly bucket: Bucket;
  readonly distribution: Distribution;

  constructor(scope: Construct, id: string, props: PreviewSiteStackProps) {
    super(scope, id, props);

    this.bucket = new Bucket(this, 'Bucket', {
      bucketName: undefined,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [{ expiration: Duration.days(60) }],
    });

    const router = new CloudFrontFunction(this, 'Router', {
      runtime: FunctionRuntime.JS_2_0,
      code: FunctionCode.fromInline(PREVIEW_ROUTER_FUNCTION),
    });

    this.distribution = new Distribution(this, 'Distribution', {
      comment: 'PR previews',
      certificate: props.certificate,
      domainNames: [`*.preview.${props.domain}`],
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        functionAssociations: [{ function: router, eventType: FunctionEventType.VIEWER_REQUEST }],
      },
    });

    const zone = HostedZone.fromLookup(this, 'Zone', { domainName: props.domain });
    new ARecord(this, 'Wildcard', {
      zone,
      recordName: `*.preview.${props.domain}`,
      target: RecordTarget.fromAlias(new CloudFrontTarget(this.distribution)),
    });

    new CfnOutput(this, 'PreviewBucket', { value: this.bucket.bucketName });
    new CfnOutput(this, 'PreviewDistributionId', { value: this.distribution.distributionId });
  }
}
