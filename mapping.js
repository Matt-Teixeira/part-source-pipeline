let INV_FEED = {
  "ItemNumberorderableSKU": "00.035.015               ",
  "Vendor": "Avante Health Solutions",
  "QOH": "10",
  "StockYN": "Y",
  "LeadTimeEstimatedShipDateBusinessDays": "Next Day",
  "ConditionCodeNewOEMOriginalNewAftermarketRefurbished": "Refurbished",
  // Down: not used
  "InventoryID": "00.035.015               ",
  "InventoryID_2": "00.035.015               ",
  "Subitem": "0",
  "Warehouse": "AUE MAIN  ",
  "RefNoteID": "d38302a2-6868-ea11-817c-8cbf77a7ab76",
  "Attribute": "PARTGROUP",
  "InventoryID_3": "00.035.015               ",
  "Currency": "USD",
  "ReplClass": "PURCHASE",
  "InventoryID_4": "00.035.015               ",
  "Subitem_2": "0",
  "Warehouse_2": "AUE MAIN  ",
  "Location": "A48       ",
  "InventoryID_5": 76378,
  "CuryID": "USD",
  "Warehouse_3": "AUE MAIN  ",
  "LocationID": "A48       "
};

let mapped_INV_FEED = {
  "ItemNumberorderableSKU": "00.035.015", // csv header = "Item Number (orderable SKU)"
  "Vendor": "Avante Health Solutions", // csv header = "Vendor"
  "QOH": "10", // csv header = "QOH"
  "StockYN": "Y", // csv header = "Stock: Y/N"
  "LeadTimeEstimatedShipDateBusinessDays": "Next Day", // csv header = "Lead Time / Estimated Ship Date (business Days)"
  "ConditionCodeNewOEMOriginalNewAftermarketRefurbished": "Refurbished",  // csv header = ""Condition Code (New OEM Original; New Aftermarket; Refurbished)"
};

let INV_FEED_2 = {
"ItemNumber": "00.035.036               ",
"Vendor": "Avante Health Solutions",
"OEM": "ULTRASONIX",
"PartDescription": "UMC MC9-4, 4-9MHz transducer",
"ListPrice": "3000.0000",
"OutrightCosttoPartsSource": "3000.000000",
"ExchangeCost": "3000.000000000",
"CoreCharge": "0.00",
"ConditionCode": "Refurbished",
"UOM": "Each",
"QTYUOM": "Each",
"StockYN": "Y",
"QOH": "1",
"LeadTime": "NextDay",
"SystemManufacturer": " ",
"CompatibleModels": " ",
"ManufacturedYear": " ",
"Usage": " ",
// Down: not used
"InventoryID": "00.035.036               ",
"InventoryID_2": 76384,
"CuryID": "USD",
"InventoryID_3": "00.035.036               ",
"Subitem": "0",
"Warehouse": "AUE MAIN  ",
"InventoryID_4": "00.035.036               ",
"Subitem_2": "0",
"Warehouse_2": "AUE MAIN  ",
"Location": "A65       ",
"RefNoteID": "3f8402a2-6868-ea11-817c-8cbf77a7ab76",
"Attribute": "PARTGROUP",
"InventoryID_5": "00.035.036               ",
"Currency": "USD",
"ReplClass": "PURCHASE",
"Warehouse_3": "AUE MAIN  ",
"LocationID": "A65       "
};

let mapped_INV_FEED_2 = {
  "ItemNumber": "00.035.038", // csv header = "Item Number"
  "Vendor": "Avante Health Solutions", // csv header = "Vendor"
  "OEM": "ULTRASONIX", // csv header = "OEM"
  "PartDescription": "UMC SA4-2/20mm X'dcr", // csv header = "Part Description"
  "ListPrice": "500.0000", // csv header = "List Price"
  "OutrightCosttoPartsSource": "500.000000", // csv header = "Outright Cost to PartsSource"
  "ExchangeCost": "500.000000000", // csv header = "Exchange Cost"
  "CoreCharge": "0.00", // csv header = "Core Charge"
  "UOM": "Each", // csv header = "UOM"
  "QTYUOM": "Each", // csv header = "QTY / UOM"
  "ConditionCode": "Refurbished", // csv header = "Condition Code"
  "StockYN": "Y", // csv header = "Stock: Y/N"
  "QOH": "1", // csv header = "QOH"
  "LeadTime": "NextDay", // csv header = "Lead Time"
  "SystemManufacturer": " ", // csv header = "System Manufacturer"
  "CompatibleModels": " ", // csv header = "Compatible Models"
  "ManufacturedYear": " ", // csv header = "Manufactured Year"
  "Usage": " ", // csv header = "Usage"
};
// Need "Core Charge"