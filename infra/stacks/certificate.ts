import { Stack } from 'aws-cdk-lib';
import type { StackProps } from 'aws-cdk-lib';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import type { Construct } from 'constructs';

export interface CertificateStackProps extends StackProps {
  /** Route 53 hosted zone, e.g. "example.com". */
  zoneName: string;
  domainNames: [string, ...string[]];
}

/** CloudFront certificates must live in us-east-1. */
export class CertificateStack extends Stack {
  readonly certificate: Certificate;

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id, props);
    const zone = HostedZone.fromLookup(this, 'Zone', { domainName: props.zoneName });
    const [domainName, ...subjectAlternativeNames] = props.domainNames;
    this.certificate = new Certificate(this, 'Certificate', {
      domainName,
      subjectAlternativeNames,
      validation: CertificateValidation.fromDns(zone),
    });
  }
}
