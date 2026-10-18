import { createFileRoute } from '@tanstack/react-router';
import { LogisticsRecords, logisticsOptions } from '@/components/LogisticsRecords';
import { phaseHead } from '@/lib/phase2';
export const Route = createFileRoute('/_authenticated/issues')({
  head: () => phaseHead('Store issues', 'Protected LNPATS store issues management and audited logistics records.'),
  loader: ({context}) => context.queryClient.ensureQueryData(logisticsOptions('issues')),
  component: () => <LogisticsRecords kind="issues" />,
});
