import { useI18n } from "../../lib/i18n";

// One inline-error presentation for every form: the field carries aria-invalid
// and aria-describedby pointing at this element's id.
export function FieldError({ id, message }: { id: string; message: string }) {
  const { t } = useI18n();
  return (
    <p id={id} role="alert" className="rounded-control border border-brand-danger/20 bg-brand-danger/[0.05] px-3 py-2 text-sm leading-5 text-brand-danger">
      {t(message)}
    </p>
  );
}
