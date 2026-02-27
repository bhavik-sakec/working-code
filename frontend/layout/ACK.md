# ACK FILE LAYOUT

Purpose:
Acknowledgement file generated after MRX file validation.

Record Length: 220 characters  
File Type: Fixed-width

---

## ACK PROCESSING LOGIC

There are ONLY TWO possible outcomes:

A = ACCEPT  
R = REJECT

---

## REJECT RULES

If Status = R:

- Reject Code is REQUIRED
- Reject Description must match Reject ID
- Claim will not proceed to RESP processing

---

## HEADER RECORD (H)

| START | END | LEN | DESCRIPTION         |
| ----- | --- | --- | ------------------- |
| 1     | 1   | 1   | Record Type = H     |
| 2     | 6   | 5   | PRIME               |
| 7     | 31  | 25  | Sender = BCBSMN     |
| 32    | 39  | 8   | Creation Date       |
| 40    | 47  | 8   | Selection From Date |
| 48    | 55  | 8   | Selection To Date   |
| 56    | 220 | 175 | Filler              |

---

## DATA RECORD (D)

| START | END | LEN | DESCRIPTION                 |
| ----- | --- | --- | --------------------------- |
| 1     | 1   | 1   | Record Type = D             |
| 2     | 21  | 20  | Claim Number                |
| 22    | 26  | 5   | Claim Line Number           |
| 27    | 56  | 30  | Member ID                   |
| 158   | 159 | 2   | ACK Status (A / R)          |
| 160   | 169 | 10  | Reject Code (Required if R) |

---

## ACK REJECT CODES

| Reject ID | Reject Description                                                     |
| --------- | ---------------------------------------------------------------------- |
| EDI3108   | Reject to client - Client's Claim Number Not on File                   |
| EDI3119   | Reject to client - Duplicate Claim # Submitted                         |
| EDI3130   | Reject to client - Duplicate claim/line                                |
| EDI3188   | Reject to client - Client's Claim Line Number Missing                  |
| EDI3107   | Reject to client - Claim's DOS Prior to Client's Contracted Start Date |
| EDI1300   | Reject to client - The Service From Date is Invalid                    |
| EDI1310   | Reject to client - The Service To Date is Invalid                      |
| EDI1330   | Reject to client - The Service From/To Date is after the Received Date |
| EDI3136   | Reject to client - Client received date missing or invalid             |
| EDI3121   | Reject to client - Member ID Missing                                   |
| EDI3122   | Reject to client - Patient Name Missing                                |
| EDI3123   | Reject to client - Patient DOB Missing                                 |
| EDI3124   | Reject to client - TIN Missing                                         |
| EDI3132   | Reject to client - Diagnosis Code Missing                              |
| EDI3109   | Reject to client - non-covered Place of Service                        |
| EDI3126   | Reject to client - non-Covered Type of Bill                            |
| EDI3110   | Reject to client - non-covered Procedure Code                          |
| EDI3120   | Reject to client - Line Item Service Unit Count equals zero            |
| EDI3115   | Reject to client - Line Item Charge Amount not received                |
| EDI3118   | Reject to client - Allowed Amount is Greater than Billed Amt           |
| EDI3129   | Reject to client - Line of Business missing or not contracted          |
| EDI3133   | Reject to client - Client Claim Status Missing                         |

---

## TRAILER RECORD (T)

| START | END | LEN | DESCRIPTION     |
| ----- | --- | --- | --------------- |
| 1     | 1   | 1   | Record Type = T |
| 2     | 8   | 7   | Trailer         |
| 9     | 28  | 20  | Total Records   |
| 29    | 220 | 202 | Filler          |
