import type { ComponentProps, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, Search } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  Badge,
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
  return <div className={cn('space-y-6', className)}>{children}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-3">
        <Badge variant="secondary" className="rounded-full bg-primary/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-primary">
          {eyebrow}
        </Badge>
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {title}
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
            {description}
          </p>
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
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
  description: string;
  actions?: ReactNode;
  spotlight?: ReactNode;
}) {
  return (
    <Card className="border-border/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-soft">
      <CardContent className="flex flex-col gap-6 p-6 lg:flex-row lg:items-end lg:justify-between lg:p-8">
        <div className="max-w-3xl space-y-4">
          <Badge className="border-white/10 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/80">
            Workspace
          </Badge>
          <div className="space-y-3">
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
            <p className="max-w-2xl text-sm leading-6 text-slate-200 sm:text-base">{description}</p>
          </div>
          {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        {spotlight ? (
          <div className="min-w-[280px] rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
            {spotlight}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</div>;
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
  hint: string;
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
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          </div>
          {Icon ? (
            <div className="rounded-xl border border-border/60 bg-background/70 p-2.5 text-primary shadow-sm">
              <Icon className="h-4 w-4" />
            </div>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">{hint}</p>
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
      <Card className="h-full border-border/60 bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft">
        <CardContent className="flex h-full flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <ArrowRight className="h-4 w-4 text-primary" />
          </div>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
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
  description: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('border-border/60 shadow-sm', className)}>
      <CardHeader className="gap-4 border-b border-border/60 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription className="max-w-2xl leading-6">{description}</CardDescription>
        </div>
        {action ? <div className="flex flex-wrap items-center gap-3">{action}</div> : null}
      </CardHeader>
      <CardContent className="p-5">{children}</CardContent>
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
    <div className={cn('flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-muted/40 p-4', className)}>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
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
    <div className="rounded-xl border border-border/60 bg-muted/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="mt-2 text-sm font-medium text-foreground">{value}</div>
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
        'flex w-full items-start justify-between gap-4 rounded-2xl border px-4 py-4 text-left transition-all',
        selected
          ? 'border-primary/40 bg-primary/5 shadow-sm'
          : 'border-border/60 bg-background hover:border-primary/25 hover:bg-muted/40'
      )}
    >
      <div className="space-y-1">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="text-sm leading-6 text-muted-foreground">{subtitle}</div>
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
    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 px-6 py-12 text-center">
      <div className="mx-auto max-w-md space-y-3">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        {action ? <div className="flex justify-center">{action}</div> : null}
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
    <div className="overflow-hidden rounded-2xl border border-border/60">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent">
            {headers.map((header) => (
              <TableHead key={header}>{header}</TableHead>
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
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</h3>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
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
