import {
  getSpecialtyIconKey,
  specialtyIconRegistry,
} from './specialty-icon-registry';

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
