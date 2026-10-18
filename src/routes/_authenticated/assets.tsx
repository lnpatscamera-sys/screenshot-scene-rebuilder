import { createFileRoute } from '@tanstack/react-router';
import { LogisticsRecords, logisticsOptions } from '@/components/LogisticsRecords';
import { phaseHead } from '@/lib/phase2';
export const Route = createFileRoute('/_authenticated/assets')({
  head: () => phaseHead('Asset register', 'Protected LNPATS asset register management and audited logistics records.'),
  loader: ({context}) => context.queryClient.ensureQueryData(logisticsOptions('assets')),
  component: () => <LogisticsRecords kind="assets" />,
});
