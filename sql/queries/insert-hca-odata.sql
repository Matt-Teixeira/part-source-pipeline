INSERT INTO api.hca_odata (
  raw_equipment,
  clean_equipment,
  raw_tech_support,
  clean_tech_support,
  raw_invoice,
  clean_invoice,
  raw_contract_details,
  clean_contract_details,
  raw_srv_order_details,
  clean_srv_order_details
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING capture_datetime;
