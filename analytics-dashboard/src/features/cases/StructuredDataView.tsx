import type { ReactNode } from 'react';

type StructuredDataViewProps = {
  data: unknown;
  emptyLabel?: string;
};

function isPrimitive(value: unknown): value is string | number | boolean {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatKeyLabel(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (character) => character.toUpperCase());
}

function renderValue(value: unknown): ReactNode {
  if (value == null) {
    return <span className="text-sm text-slate-500">Not recorded</span>;
  }

  if (isPrimitive(value)) {
    return (
      <span className="whitespace-pre-wrap break-words text-sm text-slate-900">
        {String(value)}
      </span>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-sm text-slate-500">No items recorded</span>;
    }

    if (value.every(isPrimitive)) {
      return (
        <div className="flex flex-wrap gap-2">
          {value.map((item, index) => (
            <span
              key={`${String(item)}-${index}`}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
            >
              {String(item)}
            </span>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {value.map((item, index) => (
          <div
            key={index}
            className="rounded-lg border border-slate-200 bg-white p-3"
          >
            {renderValue(item)}
          </div>
        ))}
      </div>
    );
  }

  if (isRecord(value)) {
    const entries = Object.entries(value);

    if (entries.length === 0) {
      return <span className="text-sm text-slate-500">No structured data</span>;
    }

    return (
      <dl className="space-y-2">
        {entries.map(([key, nestedValue]) => (
          <div
            key={key}
            className="rounded-lg border border-slate-200 bg-white p-3"
          >
            <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {formatKeyLabel(key)}
            </dt>
            <dd className="mt-2">{renderValue(nestedValue)}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <pre className="overflow-x-auto rounded-lg bg-white p-3 text-xs text-slate-700">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default function StructuredDataView({
  data,
  emptyLabel = 'No data available.',
}: StructuredDataViewProps) {
  if (data == null) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>;
  }

  return renderValue(data);
}
