import { createFileRoute } from '@tanstack/react-router';
import { Supplies } from './supplies';
import { phaseHead } from '@/lib/phase2';
export const Route = createFileRoute('/_authenticated/equipment-requests')({ head: () => phaseHead('Equipment requests', 'Manage LNPATS equipment requests through protected approvals and stock collection.'), component: Supplies });
