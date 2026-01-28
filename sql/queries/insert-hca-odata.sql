INSERT INTO api.hca_odata (hca_data, clean_hca_data)
VALUES ($1, $2)
RETURNING id, capture_datetime;
