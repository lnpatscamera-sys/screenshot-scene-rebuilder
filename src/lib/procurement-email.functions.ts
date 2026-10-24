import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const emailPurchaseOrder = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const access = await db.rpc('procurement_staff');
    if (access.error || !access.data) throw new Error('Only Procurement staff may email purchase orders.');
    const order = await db.from('purchase_orders').select('*').eq('id', data.id).single();
    if (order.error) throw new Error('Purchase order not found.');
    if (order.data.status !== 'Approved' && order.data.status !== 'Sent') throw new Error('Approve the order before emailing the vendor.');
    if (!order.data.vendor_id) throw new Error('Vendor is missing.');
    const [vendor, items] = await Promise.all([
      db.from('vendors').select('company_name,email,status').eq('id', order.data.vendor_id).single(),
      db.from('purchase_order_items').select('description,quantity,unit_price').eq('po_id', data.id).order('created_at'),
    ]);
    if (vendor.error || items.error) throw new Error('The order details could not be loaded.');
    if (!vendor.data.email || vendor.data.status !== 'Active') throw new Error('The active vendor needs an email address.');
    const { sendTemplateEmail } = await import('@/lib/email-templates/send-email');
    const currency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
    const result = await sendTemplateEmail('purchase-order', vendor.data.email, {
      idempotencyKey: `purchase-order-${data.id}`,
      templateData: { number: order.data.po_number, vendor: vendor.data.company_name, amount: currency(Number(order.data.amount)), delivery: order.data.delivery_date, notes: order.data.notes, lines: items.data.map(i => `${i.description} · ${i.quantity} × ${currency(i.unit_price)} = ${currency(i.quantity * i.unit_price)}`).join('\n') },
    });
    if (result.sent && order.data.status === 'Approved') {
      const sent = await db.rpc('procurement_action', { _module: 'purchase_orders', _id: data.id, _action: 'send', _note: 'Purchase order emailed to vendor' });
      if (sent.error) throw new Error('Email was accepted, but the order status could not be updated. Refresh and mark it sent.');
    }
    return result;
  });