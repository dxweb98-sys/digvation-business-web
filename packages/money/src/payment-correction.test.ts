import { describe, expect, it } from 'vitest';

import {
  addCorrectionRoute,
  addableRoutes,
  canRemoveCorrectionRoute,
  correctionDraftState,
  correctionMoves,
  correctionNet,
  editCorrectionAmount,
  paymentCorrectionRequest,
  removeCorrectionRoute,
  startCorrectionDraft,
  unallocatedAmount,
} from './payment-correction';

const entries = (...pairs: Array<[string, string]>) =>
  pairs.map(([routeId, amount]) => ({ routeId, amount }));

describe('payment correction composition model', () => {
  describe('initial composition', () => {
    it('selects only routes that currently hold money; zero-value routes stay hidden', () => {
      const draft = startCorrectionDraft(
        entries(['cash', '5000.0000'], ['qris', '200350.0000'], ['bca', '0.0000'], ['bni', '0']),
      );
      expect(draft.selected).toEqual(['cash', 'qris']);
      expect(draft.total).toBe('205350');
      expect(draft.amounts).toEqual({ cash: '5000', qris: '200350' });
    });

    it('offers every route not yet in the target composition, and none twice', () => {
      const routes = [
        { routeId: 'cash' },
        { routeId: 'qris' },
        { routeId: 'bca' },
        { routeId: 'bni' },
      ];
      const draft = startCorrectionDraft(entries(['cash', '5000'], ['qris', '200350']));
      expect(addableRoutes(draft, routes).map((route) => route.routeId)).toEqual(['bca', 'bni']);
      const added = addCorrectionRoute(draft, 'bca');
      expect(addableRoutes(added, routes).map((route) => route.routeId)).toEqual(['bni']);
      // Adding the same route again changes nothing.
      expect(addCorrectionRoute(added, 'bca')).toBe(added);
    });
  });

  describe('two selected routes', () => {
    const draft = startCorrectionDraft(entries(['cash', '5000'], ['qris', '200350']));

    it('balances the other route automatically so the total stays fixed', () => {
      const edited = editCorrectionAmount(draft, 'cash', '10000');
      expect(edited.amounts).toEqual({ cash: '10000', qris: '195350' });
      expect(unallocatedAmount(edited)).toBe('0');
      const state = correctionDraftState(edited);
      expect(state.ok).toBe(true);
      if (state.ok)
        expect(state.moves).toEqual([
          { routeId: 'cash', delta: '5000' },
          { routeId: 'qris', delta: '-5000' },
        ]);
    });

    it('balances in the reverse direction too', () => {
      const edited = editCorrectionAmount(draft, 'qris', '195350');
      expect(edited.amounts).toEqual({ cash: '10000', qris: '195350' });
    });

    it('follows an emptied field with the whole total on the other route', () => {
      expect(editCorrectionAmount(draft, 'cash', '').amounts.qris).toBe('205350');
    });

    it('never makes the balancing route negative; the excess is reported instead', () => {
      const edited = editCorrectionAmount(draft, 'cash', '300000');
      expect(edited.amounts.qris).toBe('0');
      expect(unallocatedAmount(edited)).toBe('-94650');
      expect(correctionDraftState(edited)).toMatchObject({ ok: false, reason: 'UNALLOCATED' });
    });

    it('lets the operator remove one route: the survivor receives the balancing amount', () => {
      expect(canRemoveCorrectionRoute(draft)).toBe(true);
      const removed = removeCorrectionRoute(draft, 'cash');
      expect(removed.selected).toEqual(['qris']);
      expect(removed.amounts).toEqual({ qris: '205350' });
      // The removed route is corrected to zero; nothing is deleted from history.
      expect(correctionMoves(removed)).toEqual([
        { routeId: 'cash', delta: '-5000' },
        { routeId: 'qris', delta: '5000' },
      ]);
      expect(canRemoveCorrectionRoute(removed)).toBe(false);
      expect(removeCorrectionRoute(removed, 'qris')).toBe(removed);
    });
  });

  describe('adding a route', () => {
    it('adds Cash 5.000 to a single BCA 205.350 and BCA then balances to 200.350', () => {
      const single = startCorrectionDraft(entries(['bca', '205350'], ['cash', '0']));
      expect(single.selected).toEqual(['bca']);
      const added = addCorrectionRoute(single, 'cash');
      expect(added.selected).toEqual(['bca', 'cash']);
      expect(unallocatedAmount(added)).toBe('0');
      const edited = editCorrectionAmount(added, 'cash', '5000');
      expect(edited.amounts).toEqual({ bca: '200350', cash: '5000' });
      expect(correctionDraftState(edited)).toMatchObject({
        ok: true,
        moves: [
          { routeId: 'bca', delta: '-5000' },
          { routeId: 'cash', delta: '5000' },
        ],
      });
    });
  });

  describe('three or more routes', () => {
    const draft = startCorrectionDraft(
      entries(['cash', '5000'], ['bca', '100000'], ['qris', '100350']),
    );

    it('does not redistribute: it reports what is left to allocate', () => {
      const edited = editCorrectionAmount(draft, 'cash', '10000');
      expect(edited.amounts).toEqual({ cash: '10000', bca: '100000', qris: '100350' });
      expect(unallocatedAmount(edited)).toBe('-5000');
      expect(correctionDraftState(edited)).toMatchObject({
        ok: false,
        reason: 'UNALLOCATED',
        unallocated: '-5000',
      });
    });

    it('reports a positive remainder when less is allocated, and saves once the total matches', () => {
      let edited = editCorrectionAmount(draft, 'bca', '95000');
      expect(correctionDraftState(edited)).toMatchObject({ ok: false, unallocated: '5000' });
      edited = editCorrectionAmount(edited, 'cash', '10000');
      expect(unallocatedAmount(edited)).toBe('0');
      const state = correctionDraftState(edited);
      expect(state.ok).toBe(true);
      if (state.ok) expect(correctionNet(state.moves)).toBe('0');
    });

    it('removing one of three guesses nothing', () => {
      const removed = removeCorrectionRoute(draft, 'cash');
      expect(removed.selected).toEqual(['bca', 'qris']);
      expect(unallocatedAmount(removed)).toBe('5000');
      expect(correctionDraftState(removed)).toMatchObject({ ok: false, reason: 'UNALLOCATED' });
    });
  });

  describe('save rule and derived changes', () => {
    it('is not saveable without a change or with an unreadable amount', () => {
      const draft = startCorrectionDraft(entries(['cash', '5000'], ['qris', '200350']));
      expect(correctionDraftState(draft)).toMatchObject({ ok: false, reason: 'NO_CHANGE' });
      expect(correctionDraftState(editCorrectionAmount(draft, 'cash', 'abc'))).toMatchObject({
        ok: false,
        reason: 'INVALID_AMOUNT',
      });
    });

    it('derives only non-zero deltas, and they always sum to zero', () => {
      const draft = startCorrectionDraft(
        entries(['cash', '5000'], ['bca', '100000'], ['qris', '100350'], ['bni', '0']),
      );
      let edited = editCorrectionAmount(draft, 'cash', '10000');
      edited = editCorrectionAmount(edited, 'qris', '95350');
      const state = correctionDraftState(edited);
      expect(state.ok).toBe(true);
      if (!state.ok) return;
      expect(state.moves).toEqual([
        { routeId: 'cash', delta: '5000' },
        { routeId: 'qris', delta: '-5000' },
      ]);
      expect(correctionNet(state.moves)).toBe('0');
    });

    it('builds the same Runtime request for the same current and target on every surface', () => {
      const build = () => {
        const edited = editCorrectionAmount(
          startCorrectionDraft(entries(['cash', '5000.0000'], ['qris', '200350.0000'])),
          'cash',
          '10000',
        );
        const state = correctionDraftState(edited);
        if (!state.ok) throw new Error('expected a saveable draft');
        return paymentCorrectionRequest({
          expectedVersion: 7,
          reason: '  Salah nominal  ',
          moves: state.moves,
        });
      };
      expect(build()).toEqual({
        expectedVersion: 7,
        reason: 'Salah nominal',
        moves: [
          { paymentRouteId: 'cash', delta: '5000' },
          { paymentRouteId: 'qris', delta: '-5000' },
        ],
      });
      expect(build()).toEqual(build());
    });
  });
});
