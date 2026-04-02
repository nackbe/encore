import * as React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
  value: string | number;
  label: string;
  icon: React.ElementType;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
}

export function StatCard({ value, label, icon: Icon, trend }: StatCardProps) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-4 p-6">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-6 w-6 text-primary" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          <p className="truncate text-sm text-muted-foreground">{label}</p>
        </div>

        {trend && (
          <div
            className={cn(
              'flex items-center gap-1 text-sm font-medium',
              trend.direction === 'up' ? 'text-emerald-500' : 'text-red-500'
            )}
          >
            {trend.direction === 'up' ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span>{trend.value}%</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
