INSERT INTO api.hca_odata (raw_payload, clean_payload)
VALUES ($1, $2)
RETURNING capture_datetime;
