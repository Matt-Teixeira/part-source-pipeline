INSERT INTO api.hca_odata (raw_equipment, clean_equipment, raw_tech_support, clean_tech_support)
VALUES ($1, $2, $3, $4)
RETURNING capture_datetime;
