import { createFileRoute } from '@tanstack/react-router';
import { LogisticsRecords, logisticsOptions } from '@/components/LogisticsRecords';
import { phaseHead } from '@/lib/phase2';
export const Route = createFileRoute('/_authenticated/receipts')({
  head: () => phaseHead('Store receipts', 'Protected LNPATS store receipts management and audited logistics records.'),
  loader: ({context}) => context.queryClient.ensureQueryData(logisticsOptions('receipts')),
  component: () => <LogisticsRecords kind="receipts" />,
});
