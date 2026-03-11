/**
 * Action-oriented interaction components for the dashboard.
 *
 * These compose the UI primitives (Dialog, Sheet, DropdownMenu, etc.) into
 * reusable, higher-level patterns for confirm dialogs, row-action menus,
 * multi-step wizards, side-panel editors, and status indicators.
 */

import { type ReactNode, useState, useCallback, createContext, useContext, useEffect } from 'react';
import {
    AlertTriangle,
    Check,
    MoreHorizontal,
    X,
    type LucideIcon,
} from 'lucide-react';
import {
    Button,
    Badge,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    Sheet,
    SheetContent,
    SheetHeader,
    SheetBody,
    SheetFooter,
    SheetTitle,
    SheetDescription,
    Progress,
    Separator,
    cn,
} from '@felix-travel/ui';

/* ═══════════════════════════════════════════════════════════════════════════════
 * CONFIRM DIALOG
 * ═══════════════════════════════════════════════════════════════════════════════ */

export type ConfirmVariant = 'default' | 'destructive' | 'warning';

interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: ConfirmVariant;
    loading?: boolean;
    onConfirm: () => void | Promise<void>;
    children?: ReactNode;
}

const variantConfig: Record<ConfirmVariant, { icon: LucideIcon; color: string; buttonVariant: 'default' | 'destructive' }> = {
    default: { icon: Check, color: 'text-primary', buttonVariant: 'default' },
    destructive: { icon: AlertTriangle, color: 'text-destructive', buttonVariant: 'destructive' },
    warning: { icon: AlertTriangle, color: 'text-amber-600', buttonVariant: 'default' },
};

export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'default',
    loading = false,
    onConfirm,
    children,
}: ConfirmDialogProps) {
    const { icon: Icon, color, buttonVariant } = variantConfig[variant];

    const handleConfirm = useCallback(async () => {
        await onConfirm();
        onOpenChange(false);
    }, [onConfirm, onOpenChange]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <div className="flex items-start gap-3">
                        <div className={cn('mt-0.5 rounded-full border p-2', color)}>
                            <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 space-y-1">
                            <DialogTitle>{title}</DialogTitle>
                            {description && <DialogDescription>{description}</DialogDescription>}
                        </div>
                    </div>
                </DialogHeader>
                {children && <div className="px-1 py-2">{children}</div>}
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline" disabled={loading}>{cancelLabel}</Button>
                    </DialogClose>
                    <Button variant={buttonVariant} loading={loading} onClick={() => void handleConfirm()}>
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * ACTION MENU (row-level or contextual actions)
 * ═══════════════════════════════════════════════════════════════════════════════ */

export interface ActionItem {
    label: string;
    icon?: LucideIcon;
    onClick: () => void;
    variant?: 'default' | 'destructive';
    disabled?: boolean;
    disabledReason?: string;
    separator?: boolean;
}

interface ActionMenuProps {
    items: ActionItem[];
    trigger?: ReactNode;
    align?: 'start' | 'center' | 'end';
}

export function ActionMenu({ items, trigger, align = 'end' }: ActionMenuProps) {
    if (items.length === 0) return null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                {trigger ?? (
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Row actions">
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align={align} className="min-w-[180px]">
                {items.map((item, idx) => {
                    const nodes: ReactNode[] = [];
                    if (item.separator && idx > 0) {
                        nodes.push(<DropdownMenuSeparator key={`sep-${idx}`} />);
                    }
                    nodes.push(
                        <DropdownMenuItem
                            key={idx}
                            onClick={item.onClick}
                            disabled={item.disabled ?? false}
                            className={cn(item.variant === 'destructive' && 'text-destructive focus:text-destructive')}
                        >
                            {item.icon && <item.icon className="mr-2 h-4 w-4" />}
                            {item.label}
                        </DropdownMenuItem>,
                    );
                    return nodes;
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/** Inline action buttons displayed horizontally for row-level quick actions. */
export function InlineActions({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div className={cn('flex items-center gap-1', className)} onClick={(e) => e.stopPropagation()}>
            {children}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * SIDE PANEL (contextual edit & detail view)
 * ═══════════════════════════════════════════════════════════════════════════════ */

interface SidePanelProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    size?: 'sm' | 'default' | 'lg' | 'xl';
    children: ReactNode;
    footer?: ReactNode;
}

export function SidePanel({ open, onOpenChange, title, description, size = 'default', children, footer }: SidePanelProps) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" size={size}>
                <SheetHeader>
                    <SheetTitle>{title}</SheetTitle>
                    {description && <SheetDescription>{description}</SheetDescription>}
                </SheetHeader>
                <SheetBody>{children}</SheetBody>
                {footer && <SheetFooter>{footer}</SheetFooter>}
            </SheetContent>
        </Sheet>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * MULTI-STEP WIZARD
 * ═══════════════════════════════════════════════════════════════════════════════ */

export interface WizardStep {
    id: string;
    title: string;
    description?: string;
    icon?: LucideIcon;
}

interface WizardContextValue {
    steps: WizardStep[];
    currentStepIndex: number;
    currentStep: WizardStep;
    isFirst: boolean;
    isLast: boolean;
    goTo: (index: number) => void;
    next: () => void;
    prev: () => void;
    completedSteps: Set<string>;
    markCompleted: (stepId: string) => void;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function useWizard() {
    const ctx = useContext(WizardContext);
    if (!ctx) throw new Error('useWizard must be used within a Wizard');
    return ctx;
}

interface WizardProps {
    steps: WizardStep[];
    currentStepIndex: number;
    onStepChange: (index: number) => void;
    children: ReactNode;
    completedSteps?: Set<string>;
    onComplete?: () => void;
}

export function Wizard({ steps, currentStepIndex, onStepChange, children, completedSteps: controlledCompleted, onComplete }: WizardProps) {
    const [internalCompleted, setInternalCompleted] = useState<Set<string>>(new Set());
    const completed = controlledCompleted ?? internalCompleted;

    const currentStep = steps[currentStepIndex]!;
    const isFirst = currentStepIndex === 0;
    const isLast = currentStepIndex === steps.length - 1;

    const goTo = useCallback(
        (index: number) => {
            if (index >= 0 && index < steps.length) onStepChange(index);
        },
        [steps.length, onStepChange],
    );

    const next = useCallback(() => {
        if (isLast) {
            onComplete?.();
        } else {
            goTo(currentStepIndex + 1);
        }
    }, [isLast, currentStepIndex, goTo, onComplete]);

    const prev = useCallback(() => goTo(currentStepIndex - 1), [currentStepIndex, goTo]);

    const markCompleted = useCallback((stepId: string) => {
        setInternalCompleted((prev) => new Set(prev).add(stepId));
    }, []);

    const value: WizardContextValue = {
        steps, currentStepIndex, currentStep, isFirst, isLast,
        goTo, next, prev, completedSteps: completed, markCompleted,
    };

    return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}

/** Horizontal step indicator with progress. */
export function WizardStepper({ className }: { className?: string }) {
    const { steps, currentStepIndex, completedSteps, goTo } = useWizard();
    const progressPercent = steps.length > 1 ? (currentStepIndex / (steps.length - 1)) * 100 : 100;

    return (
        <div className={cn('space-y-4', className)}>
            <Progress value={progressPercent} />
            <nav aria-label="Wizard steps">
                <ol className="flex gap-1">
                    {steps.map((step, idx) => {
                        const isActive = idx === currentStepIndex;
                        const isCompleted = completedSteps.has(step.id);
                        const isPast = idx < currentStepIndex;
                        const Icon = step.icon;

                        return (
                            <li key={step.id} className="flex-1">
                                <button
                                    type="button"
                                    onClick={() => goTo(idx)}
                                    className={cn(
                                        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                                        isActive && 'bg-primary/10 text-primary',
                                        !isActive && isCompleted && 'text-foreground',
                                        !isActive && !isCompleted && isPast && 'text-foreground/70',
                                        !isActive && !isCompleted && !isPast && 'text-muted-foreground',
                                    )}
                                    aria-current={isActive ? 'step' : undefined}
                                >
                                    <span
                                        className={cn(
                                            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                                            isActive && 'bg-primary text-primary-foreground',
                                            !isActive && isCompleted && 'bg-emerald-100 text-emerald-700',
                                            !isActive && !isCompleted && 'bg-muted text-muted-foreground',
                                        )}
                                    >
                                        {isCompleted && !isActive ? (
                                            <Check className="h-3.5 w-3.5" />
                                        ) : Icon ? (
                                            <Icon className="h-3.5 w-3.5" />
                                        ) : (
                                            idx + 1
                                        )}
                                    </span>
                                    <span className="hidden min-w-0 truncate font-medium sm:block">{step.title}</span>
                                </button>
                            </li>
                        );
                    })}
                </ol>
            </nav>
        </div>
    );
}

/** Content area that conditionally renders based on active step. */
export function WizardStepContent({ stepId, children }: { stepId: string; children: ReactNode }) {
    const { currentStep } = useWizard();
    if (currentStep.id !== stepId) return null;
    return <div className="animate-in fade-in-0 slide-in-from-right-2 duration-200">{children}</div>;
}

/** Sticky footer with back/next/finish buttons. */
export function WizardFooter({
    nextLabel,
    finishLabel = 'Review & save',
    loading = false,
    nextDisabled = false,
    extraActions,
}: {
    nextLabel?: string;
    finishLabel?: string;
    loading?: boolean;
    nextDisabled?: boolean;
    extraActions?: ReactNode;
}) {
    const { isFirst, isLast, next, prev } = useWizard();

    return (
        <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-border/60 bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center gap-2">
                {!isFirst && (
                    <Button variant="outline" onClick={prev} disabled={loading}>
                        Back
                    </Button>
                )}
                {extraActions}
            </div>
            <Button onClick={next} loading={loading} disabled={nextDisabled}>
                {isLast ? finishLabel : nextLabel ?? 'Continue'}
            </Button>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * LIFECYCLE STATUS BADGE
 * ═══════════════════════════════════════════════════════════════════════════════ */

const statusVariantMap: Record<string, 'success' | 'warning' | 'info' | 'destructive' | 'secondary' | 'outline'> = {
    active: 'success',
    enabled: 'success',
    verified: 'success',
    completed: 'success',
    approved: 'success',
    live: 'success',
    draft: 'outline',
    pending: 'warning',
    pending_payment: 'warning',
    processing: 'info',
    in_progress: 'info',
    inactive: 'secondary',
    disabled: 'secondary',
    archived: 'secondary',
    expired: 'secondary',
    failed: 'destructive',
    rejected: 'destructive',
    cancelled: 'destructive',
    error: 'destructive',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
    const variant = statusVariantMap[status.toLowerCase()] ?? 'secondary';
    const label = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return <Badge variant={variant} className={className}>{label}</Badge>;
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * UNSAVED CHANGES GUARD
 * ═══════════════════════════════════════════════════════════════════════════════ */

export function useUnsavedChanges(isDirty: boolean) {
    useEffect(() => {
        if (!isDirty) return;
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isDirty]);
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * FILTER BAR
 * ═══════════════════════════════════════════════════════════════════════════════ */

export interface FilterOption {
    label: string;
    value: string;
}

export function FilterChips({
    options,
    value,
    onChange,
    className,
}: {
    options: FilterOption[];
    value: string;
    onChange: (value: string) => void;
    className?: string;
}) {
    return (
        <div className={cn('flex flex-wrap gap-1.5', className)} role="radiogroup">
            {options.map((opt) => (
                <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={value === opt.value}
                    onClick={() => onChange(opt.value)}
                    className={cn(
                        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                        value === opt.value
                            ? 'border-primary/30 bg-primary/10 text-primary'
                            : 'border-border/60 bg-background text-muted-foreground hover:bg-muted/40',
                    )}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * BULK ACTIONS BAR
 * ═══════════════════════════════════════════════════════════════════════════════ */

export function BulkActionBar({
    selectedCount,
    onClear,
    children,
}: {
    selectedCount: number;
    onClear: () => void;
    children: ReactNode;
}) {
    if (selectedCount === 0) return null;

    return (
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 animate-in slide-in-from-top-2 duration-200">
            <span className="text-sm font-medium text-primary">{selectedCount} selected</span>
            <Separator orientation="vertical" className="h-5" />
            <div className="flex items-center gap-2">{children}</div>
            <button
                type="button"
                onClick={onClear}
                className="ml-auto rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Clear selection"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * REVIEW SUMMARY (for wizard review step)
 * ═══════════════════════════════════════════════════════════════════════════════ */

export interface ReviewSection {
    title: string;
    items: Array<{ label: string; value: ReactNode }>;
}

export function ReviewSummary({ sections, warnings }: { sections: ReviewSection[]; warnings?: string[] }) {
    return (
        <div className="space-y-5">
            {warnings && warnings.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                        <AlertTriangle className="h-4 w-4" />
                        Warnings
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-amber-700">
                        {warnings.map((w, idx) => (
                            <li key={idx}>· {w}</li>
                        ))}
                    </ul>
                </div>
            )}
            {sections.map((section) => (
                <div key={section.title} className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{section.title}</h4>
                    <div className="rounded-lg border border-border/60 divide-y divide-border/60">
                        {section.items.map((item) => (
                            <div key={item.label} className="flex items-start justify-between gap-4 px-4 py-2.5">
                                <span className="text-sm text-muted-foreground">{item.label}</span>
                                <span className="text-right text-sm font-medium text-foreground">{item.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * SKELETON LOADING
 * ═══════════════════════════════════════════════════════════════════════════════ */

export function Skeleton({ className }: { className?: string }) {
    return <div className={cn('animate-pulse rounded-md bg-muted', className)} />;
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
    return (
        <div className="space-y-2">
            <div className="flex gap-4 px-4 py-3">
                {Array.from({ length: cols }, (_, i) => (
                    <Skeleton key={i} className="h-4 flex-1" />
                ))}
            </div>
            {Array.from({ length: rows }, (_, r) => (
                <div key={r} className="flex gap-4 px-4 py-3">
                    {Array.from({ length: cols }, (_, c) => (
                        <Skeleton key={c} className="h-5 flex-1" />
                    ))}
                </div>
            ))}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * SECTION STEP HEADING (for form sections in wizards)
 * ═══════════════════════════════════════════════════════════════════════════════ */

export function StepSection({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: ReactNode;
}) {
    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-base font-semibold text-foreground">{title}</h3>
                {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
            </div>
            {children}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * DETAIL PANEL HEADER (for entity detail inside sheets)
 * ═══════════════════════════════════════════════════════════════════════════════ */

export function DetailHeader({
    title,
    subtitle,
    status,
    actions,
}: {
    title: string;
    subtitle?: string;
    status?: string;
    actions?: ReactNode;
}) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                    <h3 className="truncate text-lg font-semibold text-foreground">{title}</h3>
                    {status && <StatusBadge status={status} />}
                </div>
                {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
    );
}
