import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { LoadingState } from '@/components/ui';
import type { InsightsChartsProps } from './InsightsCharts';

/**
 * Web: CanvasKit (Skia's WASM build) is ~7 MB, so it is fetched only when the
 * Insights screen opens, together with the chart code split into its own chunk.
 */
export function ChartsHost(props: InsightsChartsProps) {
  return (
    <WithSkiaWeb
      opts={{ locateFile: (file: string) => `/${file}` }}
      getComponent={() => import('./InsightsCharts')}
      fallback={<LoadingState label="Loading charts…" />}
      componentProps={props}
    />
  );
}
