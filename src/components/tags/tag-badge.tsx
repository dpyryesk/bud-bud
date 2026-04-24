'use client';

import { Badge } from '@/components/ui/badge';

type TagBadgeProps = {
  name: string;
  color: string;
  isSource?: boolean;
  className?: string;
  onRemove?: () => void;
};

export function TagBadge({ name, color, isSource, className, onRemove }: TagBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={className}
      style={{
        borderColor: color,
        backgroundColor: `${color}15`,
        color: color,
      }}
    >
      {isSource && '📌 '}
      {name}
      {onRemove && (
        <button onClick={onRemove} className="ml-1 hover:opacity-70">
          ×
        </button>
      )}
    </Badge>
  );
}
