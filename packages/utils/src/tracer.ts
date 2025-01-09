import { ConsoleSpanExporter, SimpleSpanProcessor, WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { Resource, ResourceAttributes } from '@opentelemetry/resources';
import { detectResourcesSync } from '@opentelemetry/resources/build/src/detect-resources';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { CompositePropagator, W3CTraceContextPropagator, W3CBaggagePropagator } from '@opentelemetry/core';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { createOjsFlowLoggers } from './flows/ojs-flow';

const { log__, err__ } = createOjsFlowLoggers('tracer');

export const initTracerSafe = (version: string, baseUrl: string) => {
  try {
    initTracerUnsafe(version, baseUrl);
  } catch (error) {
    err__(`Error initializing tracer: ${error}`);
  }
};

const initTracerUnsafe = (version: string, baseUrl: string) => {
  log__(`Initializing tracer with version ${version} and baseUrl ${baseUrl}`);
  const collectorUrl = getCollectorUrl(baseUrl);
  log__(`Using collector URL ${collectorUrl}`);
  const exporter = new OTLPTraceExporter({ url: collectorUrl });
  const baseAttrs: ResourceAttributes = {
    'service.version': version,
  };
  const provider = new WebTracerProvider({
    resource: new Resource(baseAttrs).merge(detectResourcesSync()),
    spanProcessors: [
      new SimpleSpanProcessor(new ConsoleSpanExporter()),
      new BatchSpanProcessor(exporter, {
        scheduledDelayMillis: 500,
      }),
    ],
  });

  provider.register({
    contextManager: new ZoneContextManager(),
    propagator: new CompositePropagator({
      propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator()],
    }),
  });

  registerInstrumentations({
    instrumentations: [new FetchInstrumentation()],
  });
  log__(`Tracer initialized`);
};

const getCollectorUrl = (fromBaseUrl: string) => {
  const baseHostname = new URL(fromBaseUrl).hostname;
  if (baseHostname === 'cde.openpaystaging.com') {
    return 'https://otel.openpaysandbox.com/v1/traces';
  } else if (baseHostname === 'cde.getopenpay.com') {
    return 'https://otel.getopenpay.com/v1/traces';
  }
  return 'http://localhost:4319/v1/traces';
};
