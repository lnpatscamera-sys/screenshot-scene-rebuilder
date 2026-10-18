import { createFileRoute } from '@tanstack/react-router';
import { LogisticsRecords, logisticsOptions } from '@/components/LogisticsRecords';
import { phaseHead } from '@/lib/phase2';
export const Route = createFileRoute('/_authenticated/vehicle-bookings')({
  head: () => phaseHead('Vehicle bookings', 'Protected LNPATS vehicle bookings management and audited logistics records.'),
  loader: ({context}) => context.queryClient.ensureQueryData(logisticsOptions('bookings')),
  component: () => <LogisticsRecords kind="bookings" />,
});
