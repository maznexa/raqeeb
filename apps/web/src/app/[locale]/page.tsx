'use client';

import { useEffect } from 'react';
import { session } from '../../lib/api';
import { useRouter } from '../../i18n/navigation';

export default function IndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(session.access ? '/app' : '/login');
  }, [router]);
  return null;
}
