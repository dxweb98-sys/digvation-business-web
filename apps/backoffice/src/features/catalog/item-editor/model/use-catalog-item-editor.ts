import { useCallback, useEffect, useReducer, useRef } from 'react';

import type { VariantPriceDraft } from './variant-price-draft';
import type { LoyaltyEarningBehavior } from '../../../../modules/loyalty/loyalty-api';
import {
  catalogItemEditorReducer,
} from './catalog-item-editor.reducer';
import {
  createCatalogItemEditorState,
  type CatalogItemEditorForm,
  type CatalogItemEditorSource,
} from './catalog-item-editor.state';

function editorIdentity(item: CatalogItemEditorSource | null | undefined) {
  if (item === undefined) return 'closed';
  if (item === null) return 'new';
  return item.id;
}

export function useCatalogItemEditor(item: CatalogItemEditorSource | null | undefined) {
  const [state, dispatch] = useReducer(
    catalogItemEditorReducer,
    item,
    createCatalogItemEditorState,
  );

  const initialPriceRef = useRef<string | null | undefined>(undefined);
  const variantsLoadedRef = useRef(false);
  const loyaltyRuleLoadedRef = useRef(false);
  const effectiveAtRef = useRef(new Date().toISOString());

  const identity = editorIdentity(item);
  const previousIdentityRef = useRef(identity);

  useEffect(() => {
    if (previousIdentityRef.current === identity) return;

    previousIdentityRef.current = identity;
    initialPriceRef.current = undefined;
    variantsLoadedRef.current = false;
    loyaltyRuleLoadedRef.current = false;
    effectiveAtRef.current = new Date().toISOString();

    dispatch({ type: 'RESET', item });
  }, [identity, item]);

  const setFormField = useCallback(
    <K extends keyof CatalogItemEditorForm>(
      field: K,
      value: CatalogItemEditorForm[K],
    ) => {
      dispatch({
        type: 'FORM_FIELD_CHANGED',
        field,
        value,
      });
    },
    [],
  );

  const hydrateDefaultPrice = useCallback((value: string) => {
    dispatch({ type: 'DEFAULT_PRICE_HYDRATED', value });
  }, []);

  const hydrateVariants = useCallback((variants: VariantPriceDraft[]) => {
    dispatch({ type: 'VARIANTS_HYDRATED', variants });
  }, []);

  const hydrateLoyalty = useCallback(
    (behavior: LoyaltyEarningBehavior, pointsPerUnit: string) => {
      dispatch({
        type: 'LOYALTY_HYDRATED',
        behavior,
        pointsPerUnit,
      });
    },
    [],
  );

  const setLoyaltyBehavior = useCallback((behavior: LoyaltyEarningBehavior) => {
    dispatch({
      type: 'LOYALTY_BEHAVIOR_CHANGED',
      behavior,
    });
  }, []);

  const setLoyaltyPointsPerUnit = useCallback((pointsPerUnit: string) => {
    dispatch({
      type: 'LOYALTY_POINTS_CHANGED',
      pointsPerUnit,
    });
  }, []);

  const selectImage = useCallback((file: File | null) => {
    dispatch({ type: 'IMAGE_SELECTED', file });
  }, []);

  const requestImageRemoval = useCallback(() => {
    dispatch({ type: 'IMAGE_REMOVAL_REQUESTED' });
  }, []);

  const setShowIssues = useCallback((value: boolean) => {
    dispatch({ type: 'SHOW_ISSUES_CHANGED', value });
  }, []);

  const setSaving = useCallback((value: boolean) => {
    dispatch({ type: 'SAVING_CHANGED', value });
  }, []);

  return {
    form: state.form,
    loyalty: state.loyalty,
    image: state.image,
    ui: state.ui,
    effectiveAt: effectiveAtRef.current,
    refs: {
      initialPrice: initialPriceRef,
      variantsLoaded: variantsLoadedRef,
      loyaltyRuleLoaded: loyaltyRuleLoadedRef,
    },
    actions: {
      setFormField,
      hydrateDefaultPrice,
      hydrateVariants,
      hydrateLoyalty,
      setLoyaltyBehavior,
      setLoyaltyPointsPerUnit,
      selectImage,
      requestImageRemoval,
      setShowIssues,
      setSaving,
    },
  };
}
