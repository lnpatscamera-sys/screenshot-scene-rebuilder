
create type public.app_role as enum ('commandant','deputy_commandant','dc_admin','dc_academy','assistant_commissioner','section_head','officer','storekeeper','finance_officer','hr_officer','ict_admin','system_admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, email text, created_at timestamptz not null default now()
);
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null, unique(user_id, role)
);
grant select, update on public.profiles to authenticated; grant all on public.profiles to service_role;
grant select on public.user_roles to authenticated; grant all on public.user_roles to service_role;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id=_user_id and role=_role) $$;
create or replace function public.has_any_role(_user_id uuid, _roles app_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id=_user_id and (role = any(_roles) or role='system_admin')) $$;

create policy "read profiles" on public.profiles for select to authenticated using (true);
create policy "update own profile" on public.profiles for update to authenticated using (auth.uid()=id);
create policy "read own roles or admin" on public.user_roles for select to authenticated using (auth.uid()=user_id or public.has_role(auth.uid(),'system_admin'));

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name, email) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email);
  insert into public.user_roles(user_id, role) values (new.id, 'officer');
  if (select count(*) from public.user_roles where role='system_admin') = 0 then
    insert into public.user_roles(user_id, role) values (new.id, 'system_admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- org
create table public.offices (id uuid primary key default gen_random_uuid(), name text not null unique, rank_order int not null default 0);
create table public.sections (id uuid primary key default gen_random_uuid(), name text not null unique);
grant select on public.offices, public.sections to authenticated; grant all on public.offices, public.sections to service_role;
alter table public.offices enable row level security; alter table public.sections enable row level security;
create policy "read offices" on public.offices for select to authenticated using (true);
create policy "read sections" on public.sections for select to authenticated using (true);

-- officers
create table public.officers (
  id uuid primary key default gen_random_uuid(),
  service_number text not null unique, photo_url text, rank text not null, full_name text not null,
  date_of_birth date, gender text, marital_status text, nationality text default 'Liberian', county text,
  address text, phone text, email text, emergency_contact text, date_joined date,
  current_assignment text, office_id uuid references public.offices(id), section_id uuid references public.sections(id),
  position text, employment_status text not null default 'Active', education text, training_history text,
  promotion_history text, commendations text, disciplinary_actions text, medical_info text, next_of_kin text,
  user_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.officers to authenticated; grant all on public.officers to service_role;
alter table public.officers enable row level security;
create policy "read officers" on public.officers for select to authenticated using (true);
create policy "hr manage officers ins" on public.officers for insert to authenticated with check (public.has_any_role(auth.uid(), array['hr_officer','commandant']::app_role[]));
create policy "hr manage officers upd" on public.officers for update to authenticated using (public.has_any_role(auth.uid(), array['hr_officer','commandant']::app_role[]));
create policy "hr manage officers del" on public.officers for delete to authenticated using (public.has_any_role(auth.uid(), array['hr_officer']::app_role[]));

-- leave
create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  officer_id uuid references public.officers(id) on delete cascade,
  requested_by uuid,
  leave_type text not null check (leave_type in ('Annual','Sick','Emergency','Maternity','Special')),
  start_date date not null, end_date date not null, reason text,
  stage int not null default 1, -- 1 section head,2 AC,3 DC,4 commandant,5 approved
  status text not null default 'Pending' check (status in ('Pending','Approved','Rejected')),
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert on public.leave_requests to authenticated; grant all on public.leave_requests to service_role;
alter table public.leave_requests enable row level security;
create policy "read leave" on public.leave_requests for select to authenticated using (true);
create policy "submit leave" on public.leave_requests for insert to authenticated with check (requested_by = auth.uid() and stage=1 and status='Pending');

-- inventory
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, name text not null, category text not null default 'Consumable',
  unit text not null default 'pcs', quantity int not null default 0, reorder_level int not null default 10,
  location text, is_asset boolean not null default false, assigned_to text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.inventory_items to authenticated; grant all on public.inventory_items to service_role;
alter table public.inventory_items enable row level security;
create policy "read inv" on public.inventory_items for select to authenticated using (true);
create policy "store ins" on public.inventory_items for insert to authenticated with check (public.has_any_role(auth.uid(), array['storekeeper']::app_role[]));
create policy "store upd" on public.inventory_items for update to authenticated using (public.has_any_role(auth.uid(), array['storekeeper']::app_role[]));
create policy "store del" on public.inventory_items for delete to authenticated using (public.has_any_role(auth.uid(), array['storekeeper']::app_role[]));

-- supply requests
create sequence public.supply_req_seq start 1001;
create table public.supply_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique default ('REQ-' || nextval('public.supply_req_seq')),
  request_date date not null default current_date,
  section_id uuid references public.sections(id), requested_by uuid, requested_by_name text,
  item_id uuid references public.inventory_items(id), item_name text not null, description text,
  quantity int not null check (quantity > 0), unit text not null default 'pcs',
  priority text not null default 'Normal' check (priority in ('Low','Normal','High','Urgent')),
  justification text,
  stage int not null default 1,
  -- 1 AC review,2 DC review,3 Commandant approve,4 DC forward,5 Logistics receive,6 Storekeeper prepare,7 Ready (logistics notify / section collect),8 Collected
  approval_status text not null default 'Pending' check (approval_status in ('Pending','Approved','Rejected')),
  collection_status text not null default 'Not Ready' check (collection_status in ('Not Ready','Preparing','Ready for Collection','Collected')),
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert on public.supply_requests to authenticated; grant all on public.supply_requests to service_role;
alter table public.supply_requests enable row level security;
create policy "read sr" on public.supply_requests for select to authenticated using (true);
create policy "section head submits" on public.supply_requests for insert to authenticated with check (requested_by = auth.uid() and stage=1 and public.has_any_role(auth.uid(), array['section_head']::app_role[]));

-- audit + notifications
create table public.audit_logs (
  id bigint generated always as identity primary key, user_id uuid, user_email text,
  action text not null, table_name text not null, record_id text, details jsonb,
  created_at timestamptz not null default now()
);
grant select on public.audit_logs to authenticated; grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "leaders read audit" on public.audit_logs for select to authenticated using (public.has_any_role(auth.uid(), array['commandant','deputy_commandant','dc_admin']::app_role[]));

create table public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid, role app_role,
  title text not null, body text, read boolean not null default false, created_at timestamptz not null default now()
);
grant select, update on public.notifications to authenticated; grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "read my notifications" on public.notifications for select to authenticated using (user_id = auth.uid() or (role is not null and public.has_any_role(auth.uid(), array[role])));
create policy "mark read" on public.notifications for update to authenticated using (user_id = auth.uid() or (role is not null and public.has_any_role(auth.uid(), array[role])));

create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare rid text;
begin
  rid := coalesce(to_jsonb(new)->>'id', to_jsonb(old)->>'id');
  insert into public.audit_logs(user_id, user_email, action, table_name, record_id, details)
  values (auth.uid(), (select email from public.profiles where id=auth.uid()), tg_op, tg_table_name, rid,
    case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end);
  return coalesce(new, old);
end $$;
create trigger audit_officers after insert or update or delete on public.officers for each row execute function public.audit_trigger();
create trigger audit_leave after insert or update or delete on public.leave_requests for each row execute function public.audit_trigger();
create trigger audit_inv after insert or update or delete on public.inventory_items for each row execute function public.audit_trigger();
create trigger audit_sr after insert or update or delete on public.supply_requests for each row execute function public.audit_trigger();
create trigger audit_roles after insert or update or delete on public.user_roles for each row execute function public.audit_trigger();

-- workflow functions
create or replace function public.leave_stage_role(_stage int) returns app_role[] language sql immutable as $$
  select case _stage when 1 then array['section_head']::app_role[] when 2 then array['assistant_commissioner']::app_role[]
    when 3 then array['dc_admin','dc_academy']::app_role[] when 4 then array['commandant']::app_role[] else array[]::app_role[] end $$;

create or replace function public.act_on_leave(_id uuid, _approve boolean, _note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r public.leave_requests;
begin
  select * into r from public.leave_requests where id=_id for update;
  if r.status <> 'Pending' then raise exception 'Request already closed'; end if;
  if not public.has_any_role(auth.uid(), public.leave_stage_role(r.stage)) then raise exception 'Not authorised for this stage'; end if;
  update public.leave_requests set
    stage = case when _approve then r.stage+1 else r.stage end,
    status = case when not _approve then 'Rejected' when r.stage=4 then 'Approved' else 'Pending' end,
    history = r.history || jsonb_build_object('stage', r.stage, 'action', case when _approve then 'approved' else 'rejected' end, 'by', (select email from profiles where id=auth.uid()), 'note', _note, 'at', now())
  where id=_id;
  if r.requested_by is not null then
    insert into public.notifications(user_id,title,body) values (r.requested_by, 'Leave request update',
      case when not _approve then 'Your leave request was rejected.' when r.stage=4 then 'Your leave request was approved.' else 'Your leave request moved to the next approval stage.' end);
  end if;
  if _approve and r.stage < 4 then
    insert into public.notifications(role,title,body) select unnest(public.leave_stage_role(r.stage+1)), 'Leave approval pending', 'A leave request awaits your review.';
  end if;
end $$;

create or replace function public.supply_stage_role(_stage int) returns app_role[] language sql immutable as $$
  select case _stage when 1 then array['assistant_commissioner']::app_role[] when 2 then array['dc_admin']::app_role[]
    when 3 then array['commandant']::app_role[] when 4 then array['dc_admin']::app_role[]
    when 5 then array['storekeeper']::app_role[] when 6 then array['storekeeper']::app_role[]
    when 7 then array['storekeeper']::app_role[] else array[]::app_role[] end $$;

create or replace function public.act_on_supply(_id uuid, _approve boolean, _note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r public.supply_requests; ns int;
begin
  select * into r from public.supply_requests where id=_id for update;
  if r.approval_status='Rejected' or r.stage>=8 then raise exception 'Request already closed'; end if;
  if not public.has_any_role(auth.uid(), public.supply_stage_role(r.stage)) then raise exception 'Not authorised for this stage'; end if;
  if not _approve and r.stage > 3 then raise exception 'Cannot reject after approval'; end if;
  ns := case when _approve then r.stage+1 else r.stage end;
  if _approve and r.stage=7 and r.item_id is not null then
    update public.inventory_items set quantity = greatest(quantity - r.quantity, 0) where id=r.item_id;
  end if;
  update public.supply_requests set stage=ns,
    approval_status = case when not _approve then 'Rejected' when ns>=4 then 'Approved' else 'Pending' end,
    collection_status = case when ns=6 then 'Preparing' when ns=7 then 'Ready for Collection' when ns=8 then 'Collected' else collection_status end,
    history = r.history || jsonb_build_object('stage', r.stage, 'action', case when _approve then 'approved' else 'rejected' end, 'by', (select email from profiles where id=auth.uid()), 'note', _note, 'at', now())
  where id=_id;
  if r.requested_by is not null then
    insert into public.notifications(user_id,title,body) values (r.requested_by, 'Request '||r.request_number,
      case when not _approve then 'Your request was rejected.' when ns=7 then 'Items are ready for collection at Logistics.' when ns=8 then 'Collection confirmed.' else 'Your request advanced to the next stage.' end);
  end if;
  if _approve and ns < 8 then
    insert into public.notifications(role,title,body) select unnest(public.supply_stage_role(ns)), 'Supply request '||r.request_number, 'A supply request needs your action.';
  end if;
end $$;
grant execute on function public.act_on_leave(uuid,boolean,text), public.act_on_supply(uuid,boolean,text) to authenticated;

create or replace function public.admin_set_role(_user_id uuid, _role app_role, _grant boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'system_admin') then raise exception 'Only system administrators can change roles'; end if;
  if _grant then insert into public.user_roles(user_id, role) values (_user_id,_role) on conflict do nothing;
  else delete from public.user_roles where user_id=_user_id and role=_role; end if;
end $$;
grant execute on function public.admin_set_role(uuid,app_role,boolean) to authenticated;

create or replace function public.list_users_with_roles() returns table(id uuid, full_name text, email text, roles app_role[])
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.email, coalesce(array_agg(r.role) filter (where r.role is not null), '{}')
  from profiles p left join user_roles r on r.user_id=p.id
  where public.has_role(auth.uid(),'system_admin') group by p.id order by p.created_at $$;
grant execute on function public.list_users_with_roles() to authenticated;

-- seed
insert into public.offices(name, rank_order) values
('Commandant Office',1),('Deputy Commandant Office',2),('Deputy Commissioner of Police for Administration',3),('Deputy Commissioner of Police Academy',4),
('Assistant Commissioner for Administration',5),('Assistant Commissioner of Induction Training',6),('Assistant Commissioner for In-Service Training',7),
('Assistant Commissioner for Planning and Curriculum Development',8),('Assistant Commissioner for Leeward Training',9);
insert into public.sections(name) values ('Human Resource'),('Finance'),('Training'),('Induction Training'),('In-Service Training'),('Planning'),('Curriculum Development'),('Leeward Training'),('Logistics'),('ICT'),('Registry'),('Procurement'),('Transport'),('Clinic'),('Welfare'),('Maintenance'),('Security');

insert into public.officers(service_number, rank, full_name, gender, county, phone, date_joined, office_id, section_id, position, employment_status, date_of_birth, marital_status)
select v.sn, v.rk, v.nm, v.g, v.c, v.ph, v.dj::date, (select id from offices where name=v.o), (select id from sections where name=v.s), v.p, v.st, v.dob::date, v.ms
from (values
('LNP-1001','Colonel','Moses K. Dolo','Male','Montserrado','0886-100-001','2004-03-12','Commandant Office','Security','Commandant','Active','1972-05-04','Married'),
('LNP-1002','Lt. Colonel','Grace T. Kollie','Female','Bong','0886-100-002','2006-07-01','Deputy Commandant Office','Human Resource','Deputy Commandant','Active','1976-09-18','Married'),
('LNP-1003','Major','Samuel B. Weah','Male','Nimba','0886-100-003','2008-01-15','Deputy Commissioner of Police for Administration','Finance','DCP Administration','Active','1978-11-02','Married'),
('LNP-1004','Major','Comfort J. Sirleaf','Female','Grand Bassa','0886-100-004','2009-02-20','Deputy Commissioner of Police Academy','Training','DCP Academy','Active','1980-02-11','Single'),
('LNP-1005','Captain','Joseph N. Tarr','Male','Margibi','0886-100-005','2011-05-09','Assistant Commissioner for Administration','Logistics','AC Administration','Active','1983-06-25','Married'),
('LNP-1006','Captain','Esther M. Gbowee','Female','Lofa','0886-100-006','2012-08-14','Assistant Commissioner of Induction Training','Induction Training','AC Induction','Active','1985-01-30','Married'),
('LNP-1007','Lieutenant','Prince A. Johnson','Male','Grand Gedeh','0886-100-007','2014-04-03','Assistant Commissioner for In-Service Training','In-Service Training','Section Head','Active','1987-03-19','Single'),
('LNP-1008','Lieutenant','Mary W. Flomo','Female','Bomi','0886-100-008','2015-10-22','Assistant Commissioner for Administration','ICT','ICT Section Head','Active','1989-12-08','Single'),
('LNP-1009','Sergeant','Daniel S. Kpoto','Male','Sinoe','0886-100-009','2017-06-06','Assistant Commissioner for Administration','Logistics','Storekeeper','Active','1990-07-14','Married'),
('LNP-1010','Sergeant','Ruth K. Togba','Female','River Cess','0886-100-010','2018-09-17','Assistant Commissioner for Leeward Training','Leeward Training','Instructor','On Leave','1992-04-27','Single'),
('LNP-1011','Corporal','Emmanuel D. Nyumah','Male','Maryland','0886-100-011','2019-11-11','Assistant Commissioner for Planning and Curriculum Development','Curriculum Development','Curriculum Officer','Active','1993-08-03','Single'),
('LNP-1012','Patrolman','Fatu L. Kamara','Female','Grand Cape Mount','0886-100-012','2021-02-01','Assistant Commissioner for Administration','Clinic','Nurse','Active','1996-10-21','Single')
) as v(sn,rk,nm,g,c,ph,dj,o,s,p,st,dob,ms);

insert into public.inventory_items(code,name,category,unit,quantity,reorder_level,location,is_asset,assigned_to) values
('INV-0001','A4 Printing Paper (ream)','Office Supply','ream',120,40,'Main Store',false,null),
('INV-0002','Blue Ballpoint Pens (box)','Office Supply','box',18,20,'Main Store',false,null),
('INV-0003','Toner Cartridge HP 26A','Consumable','pcs',6,8,'ICT Store',false,null),
('INV-0004','Uniform Shirts (Cadet)','Consumable','pcs',340,100,'Uniform Store',false,null),
('INV-0005','Training Batons','Equipment','pcs',75,20,'Armory Annex',false,null),
('INV-0006','Dell Latitude Laptop','Equipment','pcs',1,0,'ICT Section',true,'ICT Section Head'),
('INV-0007','Projector Epson EB-X41','Equipment','pcs',1,0,'Lecture Hall A',true,'Training Section'),
('INV-0008','First Aid Kits','Consumable','kit',9,15,'Clinic',false,null),
('INV-0009','Whiteboard Markers (box)','Office Supply','box',32,10,'Main Store',false,null),
('INV-0010','Radio Handset Motorola','Equipment','pcs',1,0,'Security Section',true,'Security Section');

insert into public.leave_requests(officer_id, leave_type, start_date, end_date, reason, stage, status, created_at)
select (select id from officers where service_number=v.sn), v.t, v.s::date, v.e::date, v.r, v.stg, v.st, now() - (v.d || ' days')::interval from (values
('LNP-1010','Annual','2026-10-05','2026-10-26','Annual vacation',5,'Approved',20),
('LNP-1007','Sick','2026-10-19','2026-10-23','Medical rest',2,'Pending',2),
('LNP-1012','Special','2026-11-02','2026-11-06','Family ceremony',1,'Pending',1),
('LNP-1011','Emergency','2026-10-12','2026-10-14','Family emergency',3,'Rejected',8),
('LNP-1006','Maternity','2026-12-01','2027-02-28','Maternity leave',4,'Pending',4)
) v(sn,t,s,e,r,stg,st,d);

insert into public.supply_requests(section_id, requested_by_name, item_id, item_name, description, quantity, unit, priority, justification, stage, approval_status, collection_status, created_at)
select (select id from sections where name=v.sec), v.rb, (select id from inventory_items where code=v.code), v.nm, v.dsc, v.q, v.u, v.p, v.j, v.stg, v.ap, v.cs, now() - (v.d || ' days')::interval from (values
('Training','Prince A. Johnson','INV-0001','A4 Printing Paper (ream)','For exam papers',20,'ream','High','End-of-term examinations',1,'Pending','Not Ready',1),
('ICT','Mary W. Flomo','INV-0003','Toner Cartridge HP 26A','Registry printer',2,'pcs','Urgent','Printer out of toner',3,'Pending','Not Ready',3),
('Induction Training','Esther M. Gbowee','INV-0004','Uniform Shirts (Cadet)','New intake batch',60,'pcs','Normal','Cohort 2026-B uniforms',6,'Approved','Preparing',6),
('Clinic','Fatu L. Kamara','INV-0008','First Aid Kits','Field training',3,'kit','High','Range day safety',7,'Approved','Ready for Collection',7),
('Planning','Emmanuel D. Nyumah','INV-0009','Whiteboard Markers (box)','Workshop',4,'box','Low','Curriculum workshop',8,'Approved','Collected',12)
) v(sec,rb,code,nm,dsc,q,u,p,j,stg,ap,cs,d);
