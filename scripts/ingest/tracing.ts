import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

// Only export traces when Langfuse is actually configured. Without this guard
// the exporter falls back to Langfuse Cloud with no credentials and throws a
// 401 when flushing at shutdown, even though ingestion itself succeeded.
const tracingEnabled =
  !!process.env.LANGFUSE_PUBLIC_KEY && !!process.env.LANGFUSE_SECRET_KEY;

const sdk = tracingEnabled
  ? new NodeSDK({ spanProcessors: [new LangfuseSpanProcessor()] })
  : null;

sdk?.start();

if (!tracingEnabled) {
  console.log("Tracing: disabled (LANGFUSE_* keys not set)");
}

export async function shutdownTracing(): Promise<void> {
  await sdk?.shutdown();
}
