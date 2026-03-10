import type { ComponentProps, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, Search } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  cn,
} from '@felix-travel/ui';

export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('space-y-5', className)}>{children}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function HeroPanel({
  title,
  description,
  actions,
  spotlight,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  spotlight?: ReactNode;
}) {
  return (
    <Card className="border-border/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
      <CardContent className="flex flex-col gap-5 p-5 lg:flex-row lg:items-end lg:justify-between lg:p-6">
        <div className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
          {description ? <p className="max-w-xl text-sm text-slate-300">{description}</p> : null}
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
        {spotlight ? (
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur">
            {spotlight}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: 'default' | 'success' | 'warning' | 'info';
}) {
  const toneClasses = {
    default: 'bg-card',
    success: 'bg-emerald-50',
    warning: 'bg-amber-50',
    info: 'bg-sky-50',
  };

  return (
    <Card className={cn('border-border/60 shadow-sm', toneClasses[tone])}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="text-xl font-semibold tracking-tight text-foreground">{value}</p>
          </div>
          {Icon ? (
            <div className="rounded-lg border border-border/60 bg-background/70 p-2 text-primary">
              <Icon className="h-3.5 w-3.5" />
            </div>
          ) : null}
        </div>
        {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export function QuickActionCard({
  title,
  description,
  to,
}: {
  title: string;
  description: string;
  to: string;
}) {
  return (
    <Link to={to}>
      <Card className="h-full border-border/60 bg-card transition-all hover:-translate-y-px hover:border-primary/30 hover:shadow-md">
        <CardContent className="flex h-full flex-col gap-2 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <ArrowRight className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-xs leading-5 text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('border-border/60 shadow-sm', className)}>
      <CardHeader className="gap-3 border-b border-border/60 pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-0.5">
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? <CardDescription className="max-w-xl text-xs">{description}</CardDescription> : null}
        </div>
        {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
      </CardHeader>
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  );
}

export function WorkspaceGrid({
  main,
  side,
}: {
  main: ReactNode;
  side: ReactNode;
}) {
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.9fr)]">{main}{side}</div>;
}

export function Notice({
  message,
  variant = 'default',
}: {
  message: string;
  variant?: 'default' | 'success' | 'destructive';
}) {
  return (
    <Alert variant={variant}>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function Field({
  label,
  description,
  className,
  children,
}: {
  label: string;
  description?: string | undefined;
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="space-y-1">
        <Label>{label}</Label>
        {description ? <p className="text-xs leading-5 text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative min-w-[260px]">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input className="pl-9" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  );
}

export function SelectField({
  label,
  value,
  onValueChange,
  options,
  placeholder,
  className,
  disabled,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string | undefined;
  className?: string | undefined;
  disabled?: boolean | undefined;
}) {
  const selectProps = disabled === undefined ? {} : { disabled };
  return (
    <Field label={label} className={className}>
      <Select value={value} onValueChange={onValueChange} {...selectProps}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder ?? 'Select an option'} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function SwitchField({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  disabled?: boolean | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/40 p-3', className)}>
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

export function CheckboxChip({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean | 'indeterminate') => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-full border border-border/60 bg-background px-4 py-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={onCheckedChange} />
      <span>{label}</span>
    </label>
  );
}

export function InfoGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-4 md:grid-cols-2', className)}>{children}</div>;
}

export function InfoCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

export function ListSelector({
  title,
  subtitle,
  selected,
  onClick,
  badge,
}: {
  title: string;
  subtitle: string;
  selected?: boolean;
  onClick?: () => void;
  badge?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-3 text-left transition-colors',
        selected
          ? 'border-primary/40 bg-primary/5'
          : 'border-border/60 bg-background hover:border-primary/25 hover:bg-muted/40'
      )}
    >
      <div className="space-y-0.5">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
      {badge}
    </button>
  );
}

export function EmptyBlock({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border/70 bg-muted/30 px-4 py-8 text-center">
      <div className="mx-auto max-w-sm space-y-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
        {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}

export function DataTable({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/60">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow className="hover:bg-transparent">
            {headers.map((header) => (
              <TableHead key={header} className="text-[11px]">{header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </div>
  );
}

export function DataTableEmpty({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-10 text-center text-sm text-muted-foreground">
        {label}
      </TableCell>
    </TableRow>
  );
}

export function EntityCell({
  title,
  subtitle,
}: {
  title: ReactNode;
  subtitle: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="font-medium text-foreground">{title}</div>
      <div className="text-sm text-muted-foreground">{subtitle}</div>
    </div>
  );
}

export function FieldGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-4 md:grid-cols-2', className)}>{children}</div>;
}

export function LargeFieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 xl:grid-cols-2">{children}</div>;
}

export function TextField(props: ComponentProps<typeof Input> & {
  label: string;
  description?: string | undefined;
  className?: string | undefined;
}) {
  const { label, description, className, ...inputProps } = props;
  return (
    <Field label={label} description={description} className={className}>
      <Input {...inputProps} />
    </Field>
  );
}

export function TextareaField({
  label,
  description,
  className,
  ...props
}: ComponentProps<typeof Textarea> & {
  label: string;
  description?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <Field label={label} description={description} className={className}>
      <Textarea {...props} />
    </Field>
  );
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <Separator />
      {children}
    </div>
  );
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-3', className)}>{children}</div>;
}

export function ActionButtonLink({
  to,
  children,
  variant = 'outline',
}: {
  to: string;
  children: ReactNode;
  variant?: Parameters<typeof Button>[0]['variant'];
}) {
  return (
    <Button asChild variant={variant}>
      <Link to={to}>{children}</Link>
    </Button>
  );
}
