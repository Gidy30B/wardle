UPDATE "DiagnosisRegistry"
SET "specialty" = 'Orthopaedics'
WHERE lower(regexp_replace(trim("specialty"), '[^a-z0-9]+', ' ', 'g')) IN (
  'orthopaedics',
  'orthopaedic',
  'orthopedics',
  'orthopedic'
);
