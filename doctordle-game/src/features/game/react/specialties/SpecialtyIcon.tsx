import {
  getSpecialtyIconKey,
  getSpecialtyIconTone,
  specialtyIconRegistry,
} from "./specialty-icon-registry";

export function SpecialtyIcon({
  specialty,
  className,
}: {
  specialty?: string | null;
  className?: string;
}) {
  const Icon = specialtyIconRegistry[getSpecialtyIconKey(specialty)];
  return <Icon aria-hidden="true" className={className} />;
}

export function MobileSpecialtyIcon({
  specialty,
  className = "",
  iconClassName = "",
}: {
  specialty?: string | null;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span
      className={[
        "flex shrink-0 items-center justify-center",
        getSpecialtyIconTone(specialty),
        className,
      ].join(" ")}
    >
      <SpecialtyIcon specialty={specialty} className={iconClassName} />
    </span>
  );
}
