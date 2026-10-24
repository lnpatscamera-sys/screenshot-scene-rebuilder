import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/AppShell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { hrOptions } from '@/lib/hr';
import { phaseHead } from '@/lib/phase2';
import { HREmployees } from '@/components/HREmployees';
import { HRRecords, type HRModule } from '@/components/HRRecords';
import { HRAttendance, HRLeave } from '@/components/HRAttendanceLeave';
import { HROverview, HRReports } from '@/components/HROverview';
export const Route=createFileRoute('/_authenticated/hr')({head:()=>phaseHead('Human Resources','LNPATS employee registry, recruitment, attendance, personnel records and HR reporting.'),loader:({context})=>context.queryClient.ensureQueryData(hrOptions),component:HRPage});
function HRPage(){const {data:d}=useSuspenseQuery(hrOptions);const recordTabs:{id:HRModule;label:string}[]=[{id:'vacancies',label:'Vacancies'},{id:'applicants',label:'Applicants'},{id:'appraisals',label:'Appraisals'},{id:'promotions',label:'Promotions'},{id:'transfers',label:'Transfers'},{id:'training',label:'Training records'},{id:'discipline',label:'Discipline'},{id:'payroll',label:'Payroll'}];return <div><PageHeader title="Human Resources"/><Tabs defaultValue="dashboard"><div className="overflow-x-auto mb-5"><TabsList className="w-max"><TabsTrigger value="dashboard">Dashboard</TabsTrigger><TabsTrigger value="employees">Employees</TabsTrigger><TabsTrigger value="attendance">Attendance</TabsTrigger><TabsTrigger value="leave">Leave</TabsTrigger>{recordTabs.map(t=><TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}<TabsTrigger value="reports">Reports</TabsTrigger></TabsList></div><TabsContent value="dashboard"><HROverview d={d}/></TabsContent><TabsContent value="employees"><HREmployees d={d}/></TabsContent><TabsContent value="attendance"><HRAttendance d={d}/></TabsContent><TabsContent value="leave"><HRLeave d={d}/></TabsContent>{recordTabs.map(t=><TabsContent key={t.id} value={t.id}><HRRecords d={d} module={t.id}/></TabsContent>)}<TabsContent value="reports"><HRReports d={d}/></TabsContent></Tabs></div>;}