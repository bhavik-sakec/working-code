# MRX FILE LAYOUT

Purpose:
Inbound claim file sent to MRx/Prime.

Record Length: 921 characters  
File Type: Fixed-width

--------------------------------------------------
HEADER RECORD (H)
--------------------------------------------------

| START | END | LEN | DESCRIPTION |
|------|-----|-----|-------------|
| 1 | 1 | 1 | Record Type = H |
| 2 | 26 | 25 | Sender Code = BCBSMN |
| 27 | 34 | 8 | Run Date (CCYYMMDD) |
| 35 | 79 | 45 | Original File Name |
| 80 | 921 | 842 | Filler |

--------------------------------------------------
DATA RECORD (D)
--------------------------------------------------

| START | END | LEN | DESCRIPTION |
|------|-----|-----|-------------|
| 1 | 1 | 1 | Record Type = D |
| 12 | 31 | 20 | Sender Claim Number |
| 32 | 36 | 5 | Claim Line Number |
| 37 | 66 | 30 | Member ID |
| 67 | 104 | 38 | Patient ID |
| 105 | 119 | 15 | Patient First Name |
| 135 | 159 | 25 | Patient Last Name |
| 268 | 275 | 8 | Patient DOB |
| 279 | 288 | 10 | Provider Tax ID |
| 433 | 444 | 12 | Rendering Provider NPI |
| 610 | 617 | 8 | Service From Date |
| 632 | 641 | 10 | Diagnosis Code |
| 672 | 679 | 8 | Procedure Code |
| 688 | 696 | 9 | Units / Quantity |
| 729 | 737 | 9 | Billed Amount |
| 738 | 746 | 9 | Allowed Amount |
| 768 | 768 | 1 | Adjustment Identifier |

--------------------------------------------------
TRAILER RECORD (T)
--------------------------------------------------

| START | END | LEN | DESCRIPTION |
|------|-----|-----|-------------|
| 1 | 1 | 1 | Record Type = T |
| 2 | 21 | 20 | Total Records |
| 22 | 41 | 20 | Total Claims |
| 42 | 66 | 25 | Sender Code |
| 67 | 921 | 855 | Filler |
