# RESP FILE LAYOUT

Purpose:
Adjudication response file generated after MRx processing.

Record Length: 230 characters  
File Type: Fixed-width

Naming Convention:
TEST.PRIME.BCBSMN*GEN_CLAIM_RESP*{TIMESTAMP}.TXT

---

## ADJUDICATION STATUS VALUES

PD = Paid  
DY = Denied  
PA = Partial Approval

---

## DENY CODE RULE

Denial Codes are REQUIRED when:

- Status = DY
- Status = PA

Denial Codes are NOT required when:

- Status = PD

---

## STATUS PROCESSING LOGIC

1️⃣ PAID (PD)

- Units Approved = Total Submitted Units
- Units Denied = 0
- Denial Code = Blank

---

2️⃣ DENIED (DY)

- Value in Units Approved (POS 140–148)
  MUST be transferred to Units Denied (POS 149–157)

- Units Approved (POS 140–148) MUST be set to ZERO

- Units Denied = Total Submitted Units

- Denial Code REQUIRED

---

3️⃣ PARTIAL (PA)

- Units Approved remains as calculated
- Units Denied MUST:
  - Be greater than 1
  - Be less than Units Approved
- Units Approved + Units Denied = Total Submitted Units
- Denial Code REQUIRED

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
| 56    | 230 | 175 | Filler              |

---

## DATA RECORD (D)

| START | END | LEN | DESCRIPTION                        |
| ----- | --- | --- | ---------------------------------- |
| 1     | 1   | 1   | Record Type = D                    |
| 2     | 21  | 20  | Claim Number                       |
| 22    | 26  | 5   | Claim Line Number                  |
| 116   | 127 | 12  | MRx Claim Number                   |
| 131   | 139 | 9   | Allowed Amount                     |
| 140   | 148 | 9   | Units Approved                     |
| 149   | 157 | 9   | Units Denied                       |
| 158   | 159 | 2   | Claim Status (PD / DY / PA)        |
| 160   | 169 | 10  | Denial Code (Required for DY & PA) |
| 170   | 189 | 20  | Authorization Number               |
| 190   | 197 | 8   | Procedure Code                     |

---

## RESP DENIAL CODES

| CODE | SHORT DESCRIPTION                                        | LONG DESCRIPTION                                                                                                                                                                    |
| ---- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GI   | DENY-Procedure and DOS do not match auth                 | The procedure and the date of service do not match the authorization. Based on MRX/Prime guidelines, the claim has been denied.                                                     |
| GJ   | DENY-Procedure code does not match auth                  | The procedure code does not match the authorization. Based on MRX/Prime guidelines, the claim has been denied.                                                                      |
| IO   | DENY-Patient has exceeded authorized number of visits    | Patient has exceeded the authorized number of visits/days with this provider. Based on MRX/Prime guidelines, the claim has been denied.                                             |
| IQ   | DENY-Date of Service does not match authorized date span | The date of service was not provided within the authorized date span to this provider. Based on MRX/Prime guidelines, the claim has been denied.                                    |
| 12   | DENY-itemization needed                                  | We are unable to process this claim because the information received is not sufficient. Please submit an itemized bill identifying each date of service and/or procedure performed. |
| C3   | DENY - duplicate previous submission                     | The same charges have already been processed or are still in process. Therefore the claim is denied.                                                                                |
| C5   | DENY-units per day exceed amount allowable               | Charges exceed the maximum units allowed per day. The excess units have been denied.                                                                                                |
| C6   | DENY-units exceed amount allowable for time period       | The patient has reached the maximum number of units for this condition and the claim is denied.                                                                                     |
| 42   | DENY-Clinical Dept denial (Pre Service)                  | Dates of service were already reviewed by Clinical Management and a non-authorization letter was sent. Claim denied.                                                                |
| 43   | DENY-Clinical Dept denial (Post Service)                 | Claim denied following Clinical Management review (post-service).                                                                                                                   |
| E8   | DENY-Patient not eligible                                | Member is not eligible for coverage on the date of service.                                                                                                                         |
| EB   | DENY-OCE-dx/age conflict                                 | Diagnosis code is inconsistent with patient age under CMS OPPS rules.                                                                                                               |
| G3   | DENY-DX not eligible for code                            | Diagnosis code billed is not appropriate for the treatment.                                                                                                                         |
| J7   | DENY-requested info not received                         | Requested additional information was not received. Claim denied.                                                                                                                    |
| MV   | DENY-DX not appropriate for drug billed                  | Procedure code and modifier are not appropriate for diagnosis billed.                                                                                                               |
| F9   | DENY-PAR Provider No auth on file                        | No authorization for this date of service with participating provider.                                                                                                              |
| I2   | DENY-units exceed allowable within authorization period  | Maximum authorized units reached. Claim denied.                                                                                                                                     |
| IV   | DENY-units per day exceed allowable within auth          | Charges exceed maximum authorized units per day.                                                                                                                                    |

---

## TRAILER RECORD (T)

| START | END | LEN | DESCRIPTION     |
| ----- | --- | --- | --------------- |
| 1     | 1   | 1   | Record Type = T |
| 2     | 8   | 7   | Trailer         |
| 9     | 28  | 20  | Total Records   |
| 29    | 230 | 202 | Filler          |
