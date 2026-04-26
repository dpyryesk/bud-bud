'use client';

import { Badge } from '@/components/ui/badge';

type TagBadgeProps = {
  name: string;
  color: string;
  isSource?: boolean;
  className?: string;
  onRemoveAction?: () => void;
};

export function TagBadge({ name, color, isSource, className, onRemoveAction }: TagBadgeProps) {
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
      {isSource && '💳 '}
      {name}
      {onRemoveAction && (
        <button onClick={onRemoveAction} className="ml-1 hover:opacity-70">
          ×
        </button>
      )}
    </Badge>
  );
}
