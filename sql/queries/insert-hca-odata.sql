INSERT INTO api.hca_odata (hca_data)
VALUES ($1)
RETURNING id, capture_datetime;
