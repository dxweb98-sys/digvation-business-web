import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@digvation/ui/styles.css';
import './style.css';

import { MemberPortalApp } from './member-portal-app';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MemberPortalApp />
  </StrictMode>,
);
