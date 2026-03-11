import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { cn } from '../lib/cn.js';

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
));
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName;

const sheetVariants = cva(
  'fixed z-50 gap-4 bg-background shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500',
  {
    variants: {
      side: {
        top: 'inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
        bottom: 'inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
        left: 'inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm',
        right: 'inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-lg',
      },
      size: {
        default: '',
        sm: '',
        lg: '',
        xl: '',
        full: '',
      },
    },
    compoundVariants: [
      { side: 'right', size: 'sm', className: 'sm:max-w-sm' },
      { side: 'right', size: 'default', className: 'sm:max-w-lg' },
      { side: 'right', size: 'lg', className: 'sm:max-w-2xl' },
      { side: 'right', size: 'xl', className: 'sm:max-w-4xl' },
      { side: 'right', size: 'full', className: 'sm:max-w-[calc(100vw-4rem)]' },
      { side: 'left', size: 'sm', className: 'sm:max-w-sm' },
      { side: 'left', size: 'default', className: 'sm:max-w-lg' },
      { side: 'left', size: 'lg', className: 'sm:max-w-2xl' },
      { side: 'left', size: 'xl', className: 'sm:max-w-4xl' },
    ],
    defaultVariants: {
      side: 'right',
      size: 'default',
    },
  },
);

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
  VariantProps<typeof sheetVariants> { }

const SheetContent = React.forwardRef<React.ComponentRef<typeof DialogPrimitive.Content>, SheetContentProps>(
  ({ side = 'right', size = 'default', className, children, ...props }, ref) => (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content ref={ref} className={cn(sheetVariants({ side, size }), className)} {...props}>
        <div className="flex h-full flex-col overflow-hidden">{children}</div>
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </SheetPortal>
  ),
);
SheetContent.displayName = 'SheetContent';

function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-2 border-b px-6 py-4', className)} {...props} />;
}
SheetHeader.displayName = 'SheetHeader';

function SheetBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex-1 overflow-y-auto px-6 py-4', className)} {...props} />;
}
SheetBody.displayName = 'SheetBody';

function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center justify-end gap-2 border-t px-6 py-4', className)} {...props} />;
}
SheetFooter.displayName = 'SheetFooter';

const SheetTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-lg font-semibold text-foreground', className)} {...props} />
));
SheetTitle.displayName = DialogPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));
SheetDescription.displayName = DialogPrimitive.Description.displayName;

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetBody, SheetFooter, SheetTitle, SheetDescription, SheetOverlay, SheetPortal };
