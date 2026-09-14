import { ApplicationSplash } from '@digvation/business-runtime';
import { Building2 } from 'lucide-react';

export function AuthenticationLoading() {
  return <ApplicationSplash mark={<Building2 className="size-6" />} />;
}
