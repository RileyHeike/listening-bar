import { Queue } from 'aws-cdk-lib/aws-sqs';
import { z } from 'zod';
import { defineExtension } from '../../../lib/extensions.ts';

/** Fixture extension: a queue the module can send to. */
export default defineExtension({
  name: 'queue',
  optionsSchema: z.object({ fifo: z.boolean() }).strict(),
  apply(scope, module, options, ctx) {
    const queue = new Queue(scope, 'Queue', {
      queueName: `${ctx.prefix}-${module.manifest.name}${options.fifo ? '.fifo' : ''}`,
      fifo: options.fifo || undefined,
    });
    queue.grantSendMessages(ctx.fn);
    ctx.addEnvironment('QUEUE_URL', queue.queueUrl);
  },
});
