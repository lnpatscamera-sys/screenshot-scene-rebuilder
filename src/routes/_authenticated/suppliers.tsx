import { createFileRoute } from '@tanstack/react-router';
import { LogisticsRecords, logisticsOptions } from '@/components/LogisticsRecords';
import { phaseHead } from '@/lib/phase2';
export const Route = createFileRoute('/_authenticated/suppliers')({
  head: () => phaseHead('Suppliers', 'Protected LNPATS suppliers management and audited logistics records.'),
  loader: ({context}) => context.queryClient.ensureQueryData(logisticsOptions('suppliers')),
  component: () => <LogisticsRecords kind="suppliers" />,
});
