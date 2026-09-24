import { expect, test } from '@playwright/test';

test('keeps the summary visible while an overflowing transaction order scrolls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });

  await page.evaluate(() => {
    const dialog = document.createElement('section');
    dialog.className =
      'pos-reference-transaction-dialog flex h-[92dvh] max-h-[92dvh] w-full flex-col overflow-hidden';
    dialog.style.cssText =
      'position:fixed;inset:20px auto auto 20px;width:1100px;border:1px solid black;background:white';
    dialog.innerHTML = `
      <div style="height:16px"></div>
      <div style="height:70px">Dialog header</div>
      <div style="flex:1;min-height:0;overflow:hidden">
        <div class="pos-transaction-detail-story flex h-full min-h-0 flex-col overflow-hidden gap-5 px-5 py-5">
          <div style="flex-shrink:0;height:160px">Transaction overview</div>
          <div class="pos-detail-columns">
            <div class="pos-detail-column pos-transaction-detail-order min-h-0 overflow-y-auto">
              <h2>Pesanan</h2><div style="flex-shrink:0;height:1800px">Hair Color / employee assignment</div>
            </div>
            <div class="pos-detail-column pos-transaction-detail-summary min-h-0">
              <h2>Ringkasan</h2><div>Subtotal · Promo · Penggunaan poin · Pajak · Total · payment</div>
            </div>
          </div>
        </div>
      </div>
      <div style="height:70px">Footer</div>`;
    document.body.append(dialog);
  });

  const order = page.locator('.pos-transaction-detail-order');
  const summary = page.locator('.pos-transaction-detail-summary');
  const footer = page.locator('.pos-reference-transaction-dialog > div:last-child');
  const summaryTop = await summary.evaluate((element) => element.getBoundingClientRect().top);

  const orderLayout = await order.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      clientHeight: element.clientHeight,
      overflowY: style.overflowY,
      scrollHeight: element.scrollHeight,
    };
  });
  expect(orderLayout.overflowY).toBe('auto');
  expect(orderLayout.scrollHeight).toBeGreaterThan(orderLayout.clientHeight);
  await order.evaluate((element) => {
    element.scrollTop = 500;
  });

  await expect(summary).toBeVisible();
  await expect(page.getByText('Hair Color / employee assignment')).toBeVisible();
  await expect(
    page.getByText('Subtotal · Promo · Penggunaan poin · Pajak · Total · payment'),
  ).toBeVisible();
  expect(await summary.evaluate((element) => element.getBoundingClientRect().top)).toBe(summaryTop);
  await expect(footer).toBeVisible();
});

test('keeps the compact detail composition coherent across representative transaction states', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });

  const states = [
    ['waiting', 'Menunggu', 'Menunggu pembayaran', 'border-[var(--color-warning)]/35 bg-[var(--color-warning)]/[.08]'],
    ['in-progress', 'Dikerjakan', 'Belum dibayar', 'border-[var(--color-brand)]/35 bg-[var(--color-brand)]/[.08]'],
    ['completed', 'Selesai', 'Lunas', 'border-[var(--color-success)]/35 bg-[var(--color-success)]/[.08]'],
    ['cancelled', 'Dibatalkan', 'Dibalik', 'border-[var(--color-danger)]/35 bg-[var(--color-danger)]/[.08]'],
  ] as const;

  for (const [id, transactionStatus, paymentStatus, tone] of states) {
    await page.evaluate(
      ({ transactionStatus, paymentStatus, tone }) => {
        document.querySelector('.visual-detail-fixture')?.remove();
        const dialog = document.createElement('section');
        dialog.className = 'visual-detail-fixture w-full max-w-[1060px] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]';
        dialog.innerHTML = `
          <header class="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4"><div><p class="text-base font-semibold">Detail transaksi</p><p class="mt-1 font-mono text-xs text-[var(--color-text-muted)]">TRX-2026-0001</p></div><button class="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">Tutup</button></header>
          <div class="pos-detail-columns p-5">
            <section class="pos-detail-column"><div><h2 class="text-sm font-semibold">Pesanan</h2><div class="pos-detail-panel mt-2"><p class="py-3 text-sm font-semibold">Hair Color</p><p class="pb-3 text-xs text-[var(--color-text-muted)]">Long · 1 × Rp200.000 · Performer belum ditentukan</p></div></div></section>
            <aside class="pos-detail-column"><section class="pos-financial-panel"><div class="pos-financial-panel__context"><div class="flex items-center gap-3"><span class="grid size-9 place-items-center rounded-full bg-[var(--color-brand)] text-sm font-bold text-white">N</span><div><p class="text-sm font-bold">Nida</p><p class="text-xs text-[var(--color-text-muted)]">Member · 0812••••••</p></div></div><div class="mt-3 flex flex-wrap gap-1.5"><span class="rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tone}">${transactionStatus}</span><span class="rounded-full bg-[var(--color-surface-muted)] px-2.5 py-0.5 text-xs font-semibold">${paymentStatus}</span></div><p class="mt-3 text-xs text-[var(--color-text-muted)]">INV-001 · 24 Sep 2026, 10:30</p></div><h3 class="text-sm font-semibold">Ringkasan</h3><dl class="mt-3 space-y-2 text-sm"><div class="flex justify-between"><dt>Subtotal</dt><dd>Rp200.000</dd></div><div class="flex justify-between"><dt>Promo</dt><dd class="text-[var(--color-danger)]">−Rp20.000</dd></div><div class="flex justify-between"><dt>Pajak</dt><dd>Rp17.580</dd></div><div class="flex justify-between border-t border-[var(--color-border)] pt-3 font-bold"><dt>Total</dt><dd>Rp197.580</dd></div></dl><div class="mt-4 border-t border-[var(--color-border)] pt-4"><h4 class="text-sm font-semibold">Pembayaran</h4><div class="mt-2 flex justify-between text-sm"><span>Tunai</span><strong>Rp197.580</strong></div></div></section></aside>
          </div>`;
        document.body.append(dialog);
      },
      { transactionStatus, paymentStatus, tone },
    );
    await expect(page.getByText(transactionStatus, { exact: true })).toBeVisible();
    await expect(page.getByText('Rp197.580')).toHaveCount(2);
    await page.screenshot({ path: `C:/tmp/reference-transaction-${id}.png`, fullPage: true });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText('Hair Color')).toBeVisible();
  await expect(page.getByText('Pembayaran')).toBeVisible();
  await page.screenshot({ path: 'C:/tmp/reference-transaction-narrow.png', fullPage: true });
});
