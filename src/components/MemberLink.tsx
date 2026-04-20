import { Link } from 'react-router-dom';
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
  if (!userId) return <span className={className}>{children}</span>;
  return (
    <Link
      to={`/members/${userId}`}
      className={cn('text-primary hover:underline underline-offset-2', className)}
      title={title}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </Link>
  );
}
