import { createFileRoute } from '@tanstack/react-router';
import { LogisticsRecords, logisticsOptions } from '@/components/LogisticsRecords';
import { phaseHead } from '@/lib/phase2';
export const Route = createFileRoute('/_authenticated/stock-movements')({
  head: () => phaseHead('Stock movements', 'Protected LNPATS stock movements management and audited logistics records.'),
  loader: ({context}) => context.queryClient.ensureQueryData(logisticsOptions('movements')),
  component: () => <LogisticsRecords kind="movements" />,
});
