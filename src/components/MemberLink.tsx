import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface MemberLinkProps {
  userId: string | null | undefined;
  children: React.ReactNode;
  className?: string;
  title?: string;
}

/**
 * Renders a link to the member detail page (/members/:userId).
 * Falls back to plain text if userId is missing.
 */
export function MemberLink({ userId, children, className, title }: MemberLinkProps) {
  const location = useLocation();

  if (!userId) return <span className={className}>{children}</span>;

  const currentParams = new URLSearchParams(location.search);
  const nextParams = new URLSearchParams();
  ['from', 'salesTab', 'tab'].forEach((key) => {
    const value = currentParams.get(key);
    if (value) nextParams.set(key, value);
  });

  return (
    <Link
      to={{
        pathname: `/members/${userId}`,
        search: nextParams.toString() ? `?${nextParams.toString()}` : '',
      }}
      className={cn('text-primary hover:underline underline-offset-2', className)}
      title={title}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </Link>
  );
}
