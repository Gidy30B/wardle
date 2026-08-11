export function normalizeWardleDayDate(value: Date | string = new Date()): Date {
  const parsed = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid Wardle day date: ${value}`);
  }

  return new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
    ),
  );
}

export function compareWardleDay(
  left: Date | string,
  right: Date | string = new Date(),
): number {
  const leftDay = normalizeWardleDayDate(left).getTime();
  const rightDay = normalizeWardleDayDate(right).getTime();

  if (leftDay === rightDay) {
    return 0;
  }

  return leftDay < rightDay ? -1 : 1;
}

export function isSameWardleDay(
  left: Date | string,
  right: Date | string = new Date(),
): boolean {
  return compareWardleDay(left, right) === 0;
}
