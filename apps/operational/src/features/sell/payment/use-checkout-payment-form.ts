import { useEffect, useRef, useState } from 'react';
import type { PaymentMethod } from '../transaction/model/cashier-transaction.types';
import type { SaleCustomer } from '../transaction/model/cashier-transaction.types';

/**
 * Draft state of the checkout payment form (method, route, amount, tender, reference, loyalty
 * points), the reset of the loyalty input when the customer changes, and the guard that keeps one
 * confirmed payment in flight at a time.
 */
export function useCheckoutPaymentForm({
  activeCustomer,
}: {
  activeCustomer: SaleCustomer | null;
}) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [payNow, setPayNow] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentRouteId, setPaymentRouteId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [loyaltyPoints, setLoyaltyPoints] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [tender, setTender] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isRecordingPayment, setRecordingPayment] = useState(false);
  const paymentInFlight = useRef(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- accepted baseline: state is reset when its source changes; moving it to render-time derivation is a behavioural refactor tracked separately
    setLoyaltyPoints('');
  }, [activeCustomer?.phoneE164, activeCustomer?.referenceId, activeCustomer?.type]);
  /**
   * Sends one confirmed payment. A second confirmation while the first is still on its way is
   * ignored; Runtime's idempotency key and expected version still reject any duplicate.
   */
  const sendPaymentOnce = async (send: () => Promise<void>) => {
    if (paymentInFlight.current) return;
    paymentInFlight.current = true;
    setRecordingPayment(true);
    setPaymentError(null);
    try {
      await send();
    } finally {
      paymentInFlight.current = false;
      setRecordingPayment(false);
    }
  };
  return {
    checkoutOpen,
    setCheckoutOpen,
    payNow,
    setPayNow,
    paymentMethod,
    setPaymentMethod,
    paymentRouteId,
    setPaymentRouteId,
    paymentAmount,
    setPaymentAmount,
    loyaltyPoints,
    setLoyaltyPoints,
    paymentReference,
    setPaymentReference,
    tender,
    setTender,
    paymentError,
    setPaymentError,
    isRecordingPayment,
    sendPaymentOnce,
  };
}
