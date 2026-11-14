// Synthetic Finvoice 3.0 e-invoices for demo customer CUST01787.
// Each one is tied to a real Utilities payment in the S-Pankki dataset (same date and amount).
// Companies, names and ids are fictional. In production these would come from the bank's e-invoice stream.

export type DemoInvoice = {
  id: string;
  payment: { date: string; amount: number }; // the matching Utilities row in the dataset
  xml: string;
};

const energy = `<?xml version="1.0" encoding="UTF-8"?>
<Finvoice Version="3.0">
  <SellerPartyDetails>
    <SellerPartyIdentifier>0000000-1</SellerPartyIdentifier>
    <SellerOrganisationName>Helvi Energia Oy</SellerOrganisationName>
  </SellerPartyDetails>
  <BuyerPartyDetails>
    <BuyerOrganisationName>Aino Esimerkki</BuyerOrganisationName>
    <BuyerPostalAddressDetails><BuyerPostCodeIdentifier>02130</BuyerPostCodeIdentifier><BuyerTownName>Espoo</BuyerTownName></BuyerPostalAddressDetails>
  </BuyerPartyDetails>
  <DeliveryDetails><DeliveryPeriodDetails><StartDate Format="CCYYMMDD">20260801</StartDate><EndDate Format="CCYYMMDD">20260831</EndDate></DeliveryPeriodDetails></DeliveryDetails>
  <InvoiceDetails>
    <InvoiceTypeCode>INV01</InvoiceTypeCode>
    <InvoiceTypeText>LASKU</InvoiceTypeText>
    <InvoiceNumber>HE-2026-0811-4471</InvoiceNumber>
    <InvoiceDate Format="CCYYMMDD">20260911</InvoiceDate>
    <InvoiceTotalVatIncludedAmount AmountCurrencyIdentifier="EUR">110,58</InvoiceTotalVatIncludedAmount>
    <InvoiceFreeText>Sähkönmyynti, käyttöpaikka 643000000000017871. Sopimus: Helvi Kiinteä 36 kk, tehty 1.11.2023, voimassa 31.10.2026 asti.</InvoiceFreeText>
    <InvoiceFreeText>Määräaikainen sopimuksesi päättyy 31.10.2026. Sopimus jatkuu tämän jälkeen automaattisesti toistaiseksi voimassa olevana Helvi Jatkuva -sopimuksena: energia 17,49 c/kWh ja perusmaksu 6,90 €/kk, ellei toisin sovita.</InvoiceFreeText>
    <InvoiceFreeText>Arvioitu vuosikulutuksesi on 6 500 kWh. Hinnat sisältävät arvonlisäveron 25,5 %.</InvoiceFreeText>
    <PaymentTermsDetails><InvoiceDueDate Format="CCYYMMDD">20260925</InvoiceDueDate></PaymentTermsDetails>
  </InvoiceDetails>
  <InvoiceRow>
    <ArticleName>Perusmaksu 08/2026</ArticleName>
    <DeliveredQuantity QuantityUnitCode="kk">1</DeliveredQuantity>
    <UnitPriceAmount AmountCurrencyIdentifier="EUR">5,90</UnitPriceAmount>
    <RowVatRatePercent>25,5</RowVatRatePercent>
    <RowAmount AmountCurrencyIdentifier="EUR">5,90</RowAmount>
  </InvoiceRow>
  <InvoiceRow>
    <ArticleName>Energia 08/2026, Helvi Kiinteä 36 kk</ArticleName>
    <DeliveredQuantity QuantityUnitCode="kWh">652</DeliveredQuantity>
    <UnitPriceAmount AmountCurrencyIdentifier="EUR" UnitPriceUnitCode="kWh">0,160552</UnitPriceAmount>
    <RowVatRatePercent>25,5</RowVatRatePercent>
    <RowAmount AmountCurrencyIdentifier="EUR">104,68</RowAmount>
  </InvoiceRow>
  <EpiDetails>
    <EpiIdentificationDetails><EpiDate Format="CCYYMMDD">20260911</EpiDate><EpiReference>0</EpiReference></EpiIdentificationDetails>
    <EpiPaymentInstructionDetails><EpiRemittanceInfoIdentifier IdentificationSchemeName="ISO">RF471787202608</EpiRemittanceInfoIdentifier><EpiInstructedAmount AmountCurrencyIdentifier="EUR">110,58</EpiInstructedAmount><EpiDateOptionDate Format="CCYYMMDD">20260925</EpiDateOptionDate></EpiPaymentInstructionDetails>
  </EpiDetails>
</Finvoice>`;

const transmission = `<?xml version="1.0" encoding="UTF-8"?>
<Finvoice Version="3.0">
  <SellerPartyDetails>
    <SellerPartyIdentifier>0000000-2</SellerPartyIdentifier>
    <SellerOrganisationName>Espoon Sähköverkko Oy</SellerOrganisationName>
  </SellerPartyDetails>
  <BuyerPartyDetails>
    <BuyerOrganisationName>Aino Esimerkki</BuyerOrganisationName>
    <BuyerPostalAddressDetails><BuyerPostCodeIdentifier>02130</BuyerPostCodeIdentifier><BuyerTownName>Espoo</BuyerTownName></BuyerPostalAddressDetails>
  </BuyerPartyDetails>
  <DeliveryDetails><DeliveryPeriodDetails><StartDate Format="CCYYMMDD">20260801</StartDate><EndDate Format="CCYYMMDD">20260831</EndDate></DeliveryPeriodDetails></DeliveryDetails>
  <InvoiceDetails>
    <InvoiceTypeCode>INV01</InvoiceTypeCode>
    <InvoiceNumber>ESV-26-08-90233</InvoiceNumber>
    <InvoiceDate Format="CCYYMMDD">20260901</InvoiceDate>
    <InvoiceTotalVatIncludedAmount AmountCurrencyIdentifier="EUR">61,99</InvoiceTotalVatIncludedAmount>
    <InvoiceFreeText>Sähkönsiirto, yleissiirto. Käyttöpaikka 643000000000017871. Siirtopalvelun hinnoittelu on Energiaviraston valvomaa, ja verkkoyhtiö määräytyy käyttöpaikan sijainnin mukaan.</InvoiceFreeText>
    <PaymentTermsDetails><InvoiceDueDate Format="CCYYMMDD">20260910</InvoiceDueDate></PaymentTermsDetails>
  </InvoiceDetails>
  <InvoiceRow>
    <ArticleName>Perusmaksu, yleissiirto 08/2026</ArticleName>
    <DeliveredQuantity QuantityUnitCode="kk">1</DeliveredQuantity>
    <UnitPriceAmount AmountCurrencyIdentifier="EUR">9,90</UnitPriceAmount>
    <RowAmount AmountCurrencyIdentifier="EUR">9,90</RowAmount>
  </InvoiceRow>
  <InvoiceRow>
    <ArticleName>Siirto ja sähkövero 08/2026</ArticleName>
    <DeliveredQuantity QuantityUnitCode="kWh">652</DeliveredQuantity>
    <UnitPriceAmount AmountCurrencyIdentifier="EUR" UnitPriceUnitCode="kWh">0,079893</UnitPriceAmount>
    <RowAmount AmountCurrencyIdentifier="EUR">52,09</RowAmount>
  </InvoiceRow>
</Finvoice>`;

const telecom = `<?xml version="1.0" encoding="UTF-8"?>
<Finvoice Version="3.0">
  <SellerPartyDetails>
    <SellerPartyIdentifier>0000000-3</SellerPartyIdentifier>
    <SellerOrganisationName>Kaista Oy</SellerOrganisationName>
  </SellerPartyDetails>
  <BuyerPartyDetails>
    <BuyerOrganisationName>Aino Esimerkki</BuyerOrganisationName>
  </BuyerPartyDetails>
  <InvoiceDetails>
    <InvoiceTypeCode>INV01</InvoiceTypeCode>
    <InvoiceNumber>K-9917-0926</InvoiceNumber>
    <InvoiceDate Format="CCYYMMDD">20260914</InvoiceDate>
    <InvoiceTotalVatIncludedAmount AmountCurrencyIdentifier="EUR">109,91</InvoiceTotalVatIncludedAmount>
    <InvoiceFreeText>Laskutuskausi 1.9.–30.9.2026. Toistaiseksi voimassa olevat liittymät, irtisanomisaika 1 kk.</InvoiceFreeText>
    <PaymentTermsDetails><InvoiceDueDate Format="CCYYMMDD">20260928</InvoiceDueDate></PaymentTermsDetails>
  </InvoiceDetails>
  <InvoiceRow>
    <ArticleName>Kaista 5G Rajaton 1000M (040 *** **12)</ArticleName>
    <DeliveredQuantity QuantityUnitCode="kk">1</DeliveredQuantity>
    <RowAmount AmountCurrencyIdentifier="EUR">34,96</RowAmount>
  </InvoiceRow>
  <InvoiceRow>
    <ArticleName>Kaista 5G Rajaton 1000M (050 *** **48)</ArticleName>
    <DeliveredQuantity QuantityUnitCode="kk">1</DeliveredQuantity>
    <RowAmount AmountCurrencyIdentifier="EUR">34,96</RowAmount>
  </InvoiceRow>
  <InvoiceRow>
    <ArticleName>Kaista Kuitu 1000M</ArticleName>
    <DeliveredQuantity QuantityUnitCode="kk">1</DeliveredQuantity>
    <RowAmount AmountCurrencyIdentifier="EUR">39,99</RowAmount>
  </InvoiceRow>
</Finvoice>`;

export const INVOICES: DemoInvoice[] = [
  { id: "electricity", payment: { date: "2026-09-25", amount: -110.58 }, xml: energy },
  { id: "transmission", payment: { date: "2026-09-10", amount: -61.99 }, xml: transmission },
  { id: "telecom", payment: { date: "2026-09-28", amount: -109.91 }, xml: telecom },
];
