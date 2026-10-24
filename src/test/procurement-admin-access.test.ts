// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, expect, it } from 'vitest';
const db = new PGlite();
beforeAll(async () => {
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon;
    CREATE TYPE public.app_role AS ENUM ('system_admin','commandant','ict_admin','storekeeper','auditor');
    CREATE TABLE public.user_roles(role public.app_role);
    CREATE FUNCTION public.has_role(uuid,public.app_role) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM user_roles WHERE role=$2) $$;
    CREATE FUNCTION public.has_any_role(uuid,public.app_role[]) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM user_roles WHERE role='system_admin' OR role=ANY($2)) $$;
    CREATE FUNCTION public.finance_workflow(_module text,_id uuid,_action text,_note text,_amount numeric) RETURNS void LANGUAGE plpgsql AS $$ DECLARE uid uuid := _id; BEGIN
      IF _module='commandant' AND NOT public.has_role(uid,'commandant') THEN RAISE EXCEPTION 'denied'; END IF;
      IF _module='ict_admin' AND NOT public.has_role(uid,'ict_admin') THEN RAISE EXCEPTION 'denied'; END IF;
    END $$;
    CREATE FUNCTION public.procurement_action(_module text,_id uuid,_action text,_note text,_date date) RETURNS void LANGUAGE plpgsql AS $$ DECLARE uid uuid := _id; BEGIN
      IF NOT public.has_role(uid,'storekeeper') THEN RAISE EXCEPTION 'denied'; END IF;
    END $$;
  `);
  await db.exec(readFileSync('drizzle/migrations/0020_procurement_admin_workflow_access.sql', 'utf8'));
}, 30000);
afterAll(() => db.close());
it.each(['commandant','ict_admin'])('preserves system administrator access to the %s finance approval check', async role => {
  await db.exec("TRUNCATE user_roles; INSERT INTO user_roles VALUES('system_admin');");
  await expect(db.query('SELECT finance_workflow($1,null,\'approve\',null,null)',[role])).resolves.toBeDefined();
  await db.exec("TRUNCATE user_roles; INSERT INTO user_roles VALUES('auditor');");
  await expect(db.query('SELECT finance_workflow($1,null,\'approve\',null,null)',[role])).rejects.toThrow('denied');
});
it('preserves system administrator stores approval while denying auditors', async () => {
  await db.exec("TRUNCATE user_roles; INSERT INTO user_roles VALUES('system_admin');");
  await expect(db.exec("SELECT procurement_action('goods_received_notes',null,'approve',null,null)")).resolves.toBeDefined();
  await db.exec("TRUNCATE user_roles; INSERT INTO user_roles VALUES('auditor');");
  await expect(db.exec("SELECT procurement_action('goods_received_notes',null,'approve',null,null)")).rejects.toThrow('denied');
});