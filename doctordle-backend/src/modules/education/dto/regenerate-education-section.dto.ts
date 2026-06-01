import { IsIn } from 'class-validator';
import type { EducationRegenerableSection } from '../education-section-quality-classifier.service';

export const REGENERABLE_EDUCATION_SECTIONS = [
  'differentials',
  'investigations',
  'examPearls',
  'management',
] as const satisfies readonly EducationRegenerableSection[];

export class RegenerateEducationSectionDto {
  @IsIn(REGENERABLE_EDUCATION_SECTIONS)
  section!: EducationRegenerableSection;
}
