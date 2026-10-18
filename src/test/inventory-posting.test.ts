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
    CREATE TYPE public.app_role AS ENUM ('storekeeper','commandant');
    CREATE TABLE profiles(id uuid PRIMARY KEY,email text);
    CREATE TABLE officers(id uuid PRIMARY KEY,user_id uuid);
    CREATE TABLE sections(id uuid PRIMARY KEY);
    CREATE TABLE inventory_items(id uuid PRIMARY KEY,quantity integer,unit text);
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
  for (const path of ["0008_stage_logistics_records.sql", "0009_automatic_inventory_posting.sql", "0010_stock_movement_reconciliation_details.sql", "0011_isolate_stock_issue_validation.sql"]) {
    await db.exec(readFileSync(`drizzle/migrations/${path}`, "utf8"));
  }
  await db.exec(`INSERT INTO profiles VALUES('${actor}','test'); SELECT set_config('test.actor','${actor}',false);`);
}, 30000);

beforeEach(async () => {
  await db.exec(`TRUNCATE inventory_movements,store_receipts,store_issues,stock_reconciliation,supply_requests,inventory_items,audit_logs CASCADE; SELECT set_config('test.allowed','true',false); INSERT INTO inventory_items VALUES('${item}',10,'pcs');`);
});
afterAll(async () => { await db.close(); });

describe("automatic stock posting", () => {
  it("receipt adds quantity and records before/after balances and audit", async () => {
    await db.query("insert into store_receipts(item_id,quantity) values($1,5)",[item]);
    expect(await balance()).toBe(15);
    const movement = (await db.query("select quantity,balance_before,balance_after,actor_id from inventory_movements")).rows[0];
    expect(movement).toEqual({quantity:5,balance_before:10,balance_after:15,actor_id:actor});
    expect((await db.query("select table_name from audit_logs")).rows.map(r=>r.table_name)).toEqual(expect.arrayContaining(["inventory_items","store_receipts","inventory_movements"]));
  });
  it("issue subtracts quantity", async () => {
    await db.query("insert into store_issues(item_id,quantity) values($1,3)",[item]);
    expect(await balance()).toBe(7);
    expect((await db.query("select quantity from inventory_movements")).rows[0]?.quantity).toBe(-3);
  });
  it("reconciliation uses locked actual stock and records the count variance", async () => {
    await db.query("insert into stock_reconciliation(item_id,system_quantity,counted_quantity,reason) values($1,999,4,'Count correction')",[item]);
    expect(await balance()).toBe(4);
    expect((await db.query("select system_quantity,variance from stock_reconciliation")).rows[0]).toEqual({system_quantity:10,variance:-6});
    expect((await db.query("select quantity,remarks from inventory_movements")).rows[0]).toEqual({quantity:-6,remarks:"Count correction"});
  });
  it("shortages roll back the source, balance and movement", async () => {
    await expect(db.query("insert into store_issues(item_id,quantity) values($1,11)",[item])).rejects.toThrow("Insufficient stock");
    expect(await balance()).toBe(10);
    expect((await db.query("select count(*)::int as n from inventory_movements")).rows[0]?.n).toBe(0);
  });
  it("duplicate posting IDs do not increase stock twice", async () => {
    await db.query("insert into store_receipts(id,item_id,quantity) values($1,$2,5)",[request,item]);
    await expect(db.query("insert into store_receipts(id,item_id,quantity) values($1,$2,5)",[request,item])).rejects.toThrow();
    expect(await balance()).toBe(15);
  });
  it("posted records cannot be changed or removed", async () => {
    await db.query("insert into store_receipts(item_id,quantity) values($1,5)",[item]);
    await expect(db.exec("update store_receipts set quantity=1")).rejects.toThrow("cannot be edited");
    await expect(db.exec("delete from store_receipts")).rejects.toThrow("cannot be edited");
    expect(await balance()).toBe(15);
  });
  it("unauthorized staff cannot post", async () => {
    await db.exec("select set_config('test.allowed','false',false)");
    await expect(db.query("insert into store_receipts(item_id,quantity) values($1,5)",[item])).rejects.toThrow("Only stores staff");
    expect(await balance()).toBe(10);
  });
  it("supply collection subtracts exactly once and creates one issue", async () => {
    await db.query("insert into supply_requests(id,item_id,quantity,stage,approval_status,collection_status,request_number) values($1,$2,3,7,'Approved','Ready for Collection','TEST')",[request,item]);
    await db.query("select act_on_supply($1,true,'Collected')",[request]);
    expect(await balance()).toBe(7);
    expect((await db.query("select count(*)::int as n from store_issues")).rows[0]?.n).toBe(1);
    expect((await db.query("select count(*)::int as n from inventory_movements")).rows[0]?.n).toBe(1);
    await expect(db.query("select act_on_supply($1,true,'Again')",[request])).rejects.toThrow("already closed");
    expect(await balance()).toBe(7);
  });
  it("short supply collection does not advance the request", async () => {
    await db.query("insert into supply_requests(id,item_id,quantity,stage,approval_status,collection_status) values($1,$2,11,7,'Approved','Ready for Collection')",[request,item]);
    await expect(db.query("select act_on_supply($1,true,'Collected')",[request])).rejects.toThrow("Insufficient stock");
    expect((await db.query("select stage from supply_requests")).rows[0]?.stage).toBe(7);
    expect(await balance()).toBe(10);
  });
});