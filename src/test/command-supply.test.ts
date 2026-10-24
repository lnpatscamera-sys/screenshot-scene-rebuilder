// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";

const db = new PGlite();
const item = "10000000-0000-4000-8000-000000000001";
const actor = "20000000-0000-4000-8000-000000000001";
const request = "30000000-0000-4000-8000-000000000001";
async function balance() { return (await db.query<{ quantity: number }>("select quantity from inventory_items where id=$1", [item])).rows[0]?.quantity; }

beforeAll(async () => {
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.actor',true),'')::uuid $$;
    CREATE TYPE public.app_role AS ENUM ('storekeeper','commandant','system_admin','dc_admin','procurement_officer','procurement_admin','deputy_commandant');
    CREATE TABLE profiles(id uuid PRIMARY KEY,email text,full_name text);
    CREATE TABLE officers(id uuid PRIMARY KEY,user_id uuid);
    CREATE TABLE sections(id uuid PRIMARY KEY);
    CREATE TABLE inventory_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),code text,name text,category text,quantity integer DEFAULT 0,unit text,reorder_level integer DEFAULT 10,location text,is_asset boolean DEFAULT false,assigned_to text);
    CREATE TABLE vendors(id uuid PRIMARY KEY,company_name text,contact_person text,phone text,email text,address text);
    CREATE TABLE purchase_orders(id uuid PRIMARY KEY);
    CREATE TABLE assets(id uuid PRIMARY KEY); CREATE TABLE vehicles(id uuid PRIMARY KEY);
    CREATE TABLE supply_requests(id uuid PRIMARY KEY,item_id uuid,quantity integer,unit text,item_name text,description text,section_id uuid,request_number text,stage integer,approval_status text,collection_status text,history jsonb DEFAULT '[]',requested_by uuid);
    CREATE TABLE notifications(user_id uuid,role app_role,title text,body text);
    CREATE TABLE audit_logs(table_name text,details jsonb);
    CREATE FUNCTION has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
    CREATE FUNCTION has_any_role(uuid,app_role[]) RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(current_setting('test.allowed',true),'true')='true' $$;
    CREATE FUNCTION supply_stage_role(integer) RETURNS app_role[] LANGUAGE sql AS $$ SELECT ARRAY['storekeeper']::app_role[] $$;
    CREATE FUNCTION audit_trigger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO audit_logs VALUES(TG_TABLE_NAME,jsonb_build_object('old',to_jsonb(OLD),'new',to_jsonb(NEW))); RETURN NEW; END $$;
    CREATE TRIGGER audit_inventory AFTER UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  `);
  for (const path of ["0008_stage_logistics_records.sql", "0009_automatic_inventory_posting.sql", "0010_stock_movement_reconciliation_details.sql", "0011_isolate_stock_issue_validation.sql", "0013_inventory_warehouses_costs_transfers.sql", "0014_warehouse_count_posting.sql"]) {
    await db.exec(readFileSync(`drizzle/migrations/${path}`, "utf8"));
  }
  await db.exec(`INSERT INTO profiles(id,email,full_name) VALUES('${actor}','test','Requester'); SELECT set_config('test.actor','${actor}',false);`);
}, 30000);


beforeAll(async()=>{
 await db.exec(`ALTER TABLE officers ADD COLUMN full_name text,ADD COLUMN section_id uuid,ADD COLUMN employment_status text;
 ALTER TABLE supply_requests ALTER COLUMN id SET DEFAULT gen_random_uuid();
 ALTER TABLE supply_requests ADD COLUMN requested_by_name text,ADD COLUMN priority text DEFAULT 'Normal',ADD COLUMN justification text;
 ALTER TABLE supply_requests ALTER COLUMN stage SET DEFAULT 1; ALTER TABLE supply_requests ALTER COLUMN approval_status SET DEFAULT 'Pending'; ALTER TABLE supply_requests ALTER COLUMN collection_status SET DEFAULT 'Not Ready';
 ALTER TABLE profiles ADD COLUMN unused text;
 CREATE TABLE reporting_lines(kind text,office_id uuid,officer_id uuid);
 CREATE TABLE user_roles(user_id uuid,role app_role);
 CREATE TABLE procurement_funding(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),section_id uuid,item_description text,quantity integer,requested_by uuid,priority text,justification text,unit text,estimated_cost numeric NOT NULL,stage integer DEFAULT 0,status text DEFAULT 'Draft',CONSTRAINT procurement_funding_estimated_cost_check CHECK(estimated_cost>0));
 CREATE TABLE request_items(request_id uuid,description text,quantity integer,unit text,estimated_unit_cost numeric);
 CREATE TABLE purchase_order_items(id uuid,po_id uuid,inventory_item_id uuid,quantity integer,quantity_received integer,is_asset boolean);
 ALTER TABLE purchase_orders ADD COLUMN procurement_request_id uuid,ADD COLUMN status text,ADD COLUMN created_at timestamptz;
 CREATE TABLE goods_received_notes(id uuid,po_id uuid,status text,delivery_date date);
 CREATE TABLE budgets(department uuid,status text,fiscal_year integer,remaining_amount numeric);
 CREATE TABLE daily_reports(id uuid,attachments jsonb);
 CREATE TABLE compiled_reports(id uuid,source_snapshots jsonb,created_by uuid,recipient_id uuid);
 CREATE FUNCTION command_report_reader(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
 CREATE FUNCTION command_notify(uuid,text,text,text) RETURNS void LANGUAGE sql AS $$ SELECT $$;
 CREATE FUNCTION command_validate_files(jsonb) RETURNS void LANGUAGE sql AS $$ SELECT $$;
 CREATE FUNCTION command_chain(uuid,boolean) RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_array(jsonb_build_object('user_id',auth.uid()),jsonb_build_object('user_id',auth.uid()),jsonb_build_object('user_id',auth.uid()),jsonb_build_object('user_id',auth.uid()),jsonb_build_object('user_id',auth.uid())) $$;
 CREATE POLICY "read sr" ON supply_requests FOR SELECT USING(true);
 INSERT INTO officers(id,user_id,full_name,employment_status) VALUES('${request}','${actor}','Requester','Active');
 INSERT INTO user_roles VALUES('${actor}','procurement_admin','deputy_commandant');`);
 for(const f of ['0033_command_supply_oversight.sql','0038_command_shortage_cost_initialization.sql','0039_command_draft_procurement_estimate.sql']) await db.exec(readFileSync('drizzle/migrations/'+f,'utf8'));
 await db.exec(`ALTER TABLE inventory_items DISABLE TRIGGER guard_inventory_metadata; INSERT INTO inventory_items(id,name,quantity,unit) VALUES('${item}','Stock item',10,'pcs'); ALTER TABLE inventory_items ENABLE TRIGGER guard_inventory_metadata; INSERT INTO warehouse_stock(item_id,quantity) VALUES('${item}',10);`);
},30000);
afterAll(()=>db.close());
let sid:string;
it('requires quantity, reason and required date',async()=>{await expect(db.query("select command_supply_action(null,'submit',$1)",[{quantity:0,justification:'Need',required_date:'2099-01-01',item_id:item}])).rejects.toThrow('Quantity, reason');});
it('does not reserve stock before all five approvals',async()=>{sid=(await db.query<{id:string}>("select command_supply_action(null,'submit',$1) id",[{quantity:3,justification:'Need',required_date:'2099-01-01',item_id:item}])).rows[0]?.id??'';for(let n=0;n<4;n++)await db.query("select command_supply_action($1,'approve','{}')",[sid]);expect((await db.query<{reserved_quantity:number}>('select reserved_quantity from supply_requests where id=$1',[sid])).rows[0]?.reserved_quantity).toBe(0);await db.query("select command_supply_action($1,'approve','{}')",[sid]);expect((await db.query('select approval_status,collection_status,reserved_quantity from supply_requests where id=$1',[sid])).rows[0]).toEqual({approval_status:'Approved',collection_status:'Prepare Supply',reserved_quantity:3});});
it('requires requester pickup acknowledgement before collection',async()=>{await db.query("select command_supply_action($1,'prepare','{}')",[sid]);await db.query("select command_supply_action($1,'ready','{}')",[sid]);await expect(db.query("select command_supply_action($1,'collect','{}')",[sid])).rejects.toThrow('Requester must sign pickup');expect(await balance()).toBe(10);});
it('posts signed pickup atomically exactly once',async()=>{await db.query("select command_supply_action($1,'sign_pickup',$2)",[sid,{signature:'Requester'}]);await db.query("select command_supply_action($1,'collect','{}')",[sid]);expect(await balance()).toBe(7);expect((await db.query<{n:number}>('select count(*)::int n from store_issues')).rows[0]?.n).toBe(1);expect((await db.query<{n:number}>('select count(*)::int n from inventory_movements')).rows[0]?.n).toBe(1);await expect(db.query("select command_supply_action($1,'collect','{}')",[sid])).rejects.toThrow('approved uncollected');expect(await balance()).toBe(7);});
it('routes unknown-price shortages into draft procurement without invented costs',async()=>{const id=(await db.query<{id:string}>("select command_supply_action(null,'submit',$1) id",[{quantity:1,justification:'Need',required_date:'2099-01-01',item_name:'New stock item'}])).rows[0]?.id;for(let n=0;n<5;n++)await db.query("select command_supply_action($1,'approve','{}')",[id]);const r=await db.query('select p.estimated_cost,p.stage,s.collection_status from supply_requests s join procurement_funding p on p.id=s.procurement_id where s.id=$1',[id]);expect(r.rows[0]).toEqual({estimated_cost:'0',stage:0,collection_status:'Purchase Required'});await expect(db.exec('update procurement_funding set stage=1 where estimated_cost=0')).rejects.toThrow();});
