import { Toaster as Sonner, type ToasterProps } from 'sonner';

export function Toaster({ theme, ...props }: ToasterProps) {
  return (
    <Sonner
      theme={theme}
      richColors
      closeButton
      position="bottom-right"
      toastOptions={{ classNames: { toast: 'border bg-popover text-popover-foreground' } }}
      {...props}
    />
  );
}
