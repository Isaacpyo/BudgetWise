import InsightsCharts, { type InsightsChartsProps } from './InsightsCharts';

/** Native: Skia is built in, render directly. (Web variant: ChartsHost.web.tsx.) */
export function ChartsHost(props: InsightsChartsProps) {
  return <InsightsCharts {...props} />;
}
