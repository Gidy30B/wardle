import { normalize } from './normalize';

const abbreviationMap: Record<string, string> = {
  mi: 'myocardial infarction',
  tb: 'tuberculosis',
};

function expandAbbreviations(input: string): string {
  return abbreviationMap[input] ?? input;
}

function correctSpelling(input: string): string {
  return input;
}

export async function preprocess(input: string): Promise<string> {
  return expandAbbreviations(correctSpelling(normalize(input)));
}
