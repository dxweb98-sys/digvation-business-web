import type { SaleCustomer, SaleCustomerSelection } from './cashier-transaction.types';

/**
 * Customer snapshot for the local adapters used in offline demo builds.
 *
 * Runtime owns customer resolution in every real deployment: it normalizes a
 * national number using the installation's region and it resolves member
 * identity from the canonical Customer authority. Neither is available locally,
 * so this stand-in accepts only a number already written in international form
 * and refuses member selection instead of inventing member data.
 */
export function localSaleCustomerSnapshot(selection: SaleCustomerSelection): SaleCustomer {
  if (selection.type === 'MEMBER')
    throw new Error('Member customer lookup is not available in this local build.');

  const name = selection.name.replace(/\s+/g, ' ').trim();
  if (!name) throw new Error('Customer name is required.');

  const compact = selection.phone.replace(/[\s().-]/g, '');
  const phoneE164 = compact.startsWith('00') ? `+${compact.slice(2)}` : compact;
  if (!/^\+[1-9]\d{7,14}$/.test(phoneE164))
    throw new Error(
      'Write the WhatsApp number in international format, for example +628xxxxxxxxx.',
    );

  return { type: 'NON_MEMBER', referenceId: null, name, phoneE164 };
}
