import { cn } from '@/lib/utils';

export function StatTile({
  label,
  value,
  hero = false,
  size = 'default',
  className,
  valueClassName,
}: {
  label: string;
  value: string;
  hero?: boolean;
  size?: 'default' | 'sm';
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={cn('rounded-lg border bg-card', size === 'sm' ? 'p-3' : 'p-4', className)}>
      <p className={cn('font-medium text-muted-foreground', size === 'sm' ? 'text-xs' : 'text-sm')}>
        {label}
      </p>
      <p
        className={cn(
          'mt-1 font-heading font-semibold',
          hero ? 'text-5xl text-primary' : size === 'sm' ? 'text-xl' : 'text-2xl',
          valueClassName
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function DualStatTile({
  items,
  size = 'default',
  className,
}: {
  items: { label: string; value: string; valueClassName?: string }[];
  size?: 'default' | 'sm';
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border bg-card space-y-3', size === 'sm' ? 'p-3' : 'p-4', className)}>
      {items.map((item) => (
        <div key={item.label}>
          <p className={cn('font-medium text-muted-foreground', size === 'sm' ? 'text-xs' : 'text-sm')}>
            {item.label}
          </p>
          <p className={cn('mt-1 font-heading font-semibold', size === 'sm' ? 'text-xl' : 'text-2xl', item.valueClassName)}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}