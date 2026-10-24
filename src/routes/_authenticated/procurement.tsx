import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { phaseHead } from '@/lib/phase2';
import { procurementOptions, PROCUREMENT_READERS } from '@/lib/procurement';
import { PageHeader } from '@/components/AppShell';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SearchFilters } from '@/components/ProcurementShared';
import { VendorsPanel, RequestsPanel, QuotationsPanel } from '@/components/ProcurementRequests';
import { OrdersPanel, GoodsPanel } from '@/components/ProcurementOrders';
import { ContractsPanel, PerformancePanel } from '@/components/ProcurementContracts';
import { ProcurementOverview, ProcurementReports } from '@/components/ProcurementOverview';

export const Route = createFileRoute('/_authenticated/procurement')({
  head: () => phaseHead('Procurement', 'LNPATS purchasing, vendors, quotations, approved orders, goods receipts, contracts and supplier performance.'),
  loader: ({ context }) => context.queryClient.ensureQueryData(procurementOptions),
  component: ProcurementPage,
});
function ProcurementPage() {
  const { data: d } = useSuspenseQuery(procurementOptions); const { hasAny } = useAuth(); const reader = hasAny(PROCUREMENT_READERS); const [tab, setTab] = useState(reader ? 'dashboard' : 'requests'); const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [requestId, setRequestId] = useState('');
  if (!reader && !hasAny(['section_head'])) return <><PageHeader title="Procurement" /><p className="text-muted-foreground">You do not have access to Procurement records.</p></>;
  const tabs = reader ? ['dashboard', 'vendors', 'requests', 'quotations', 'orders', 'goods', 'contracts', 'performance', 'reports'] : ['vendors', 'requests', 'quotations'];
  const labels: Record<string, string> = { dashboard: 'Dashboard', vendors: 'Vendors', requests: 'Requests', quotations: 'Quotations', orders: 'Orders', goods: 'Goods received', contracts: 'Contracts', performance: 'Supplier ratings', reports: 'Reports & audit' };
  const statuses: Record<string, string[]> = { vendors: ['Active', 'Suspended'], requests: Array.from(new Set(d.requests.map(r => r.status))), orders: ['Draft', 'Approved', 'Sent', 'Partially Delivered', 'Completed', 'Cancelled'], goods: ['Pending', 'Approved', 'Rejected'], contracts: ['Active', 'Terminated'] };
  return <><PageHeader title="Procurement" /><Tabs value={tab} onValueChange={value => { setTab(value); setSearch(''); setStatus(''); }}><div className="overflow-x-auto mb-5 no-print"><TabsList className="w-max">{tabs.map(t => <TabsTrigger value={t} key={t}>{labels[t]}</TabsTrigger>)}</TabsList></div>{!['dashboard', 'quotations', 'reports'].includes(tab) && <SearchFilters search={search} onSearch={setSearch} status={status} onStatus={setStatus} statuses={statuses[tab] ?? []} />}<TabsContent value="dashboard"><ProcurementOverview d={d} /></TabsContent><TabsContent value="vendors"><VendorsPanel d={d} search={search} status={status} /></TabsContent><TabsContent value="requests"><RequestsPanel d={d} search={search} status={status} /></TabsContent><TabsContent value="quotations"><QuotationsPanel d={d} requestId={requestId} onRequest={setRequestId} /></TabsContent><TabsContent value="orders"><OrdersPanel d={d} search={search} status={status} /></TabsContent><TabsContent value="goods"><GoodsPanel d={d} search={search} status={status} /></TabsContent><TabsContent value="contracts"><ContractsPanel d={d} search={search} status={status} /></TabsContent><TabsContent value="performance"><PerformancePanel d={d} search={search} /></TabsContent><TabsContent value="reports"><ProcurementReports d={d} /></TabsContent></Tabs></>;
}