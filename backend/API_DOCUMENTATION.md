# API Documentation - File Parser Engine

## Base URL

```
http://localhost:8080
```

## Endpoints

### 1. Parse MRX File (Upload)

**Endpoint:** `POST /api/mrx/parse`

**Description:** Upload and parse an MRX file

**Request:**

- Method: POST
- Content-Type: multipart/form-data
- Parameter: `file` (MultipartFile)

**Example (cURL):**

```bash
curl -X POST http://localhost:8080/api/mrx/parse \
  -F "file=@mrx-sample.txt"
```

**Response:**

```json
{
  "header": {
    "recordType": "H",
    "sender": "BCBSMN",
    "creationDate": "20260213",
    "filler": "..."
  },
  "dataRecords": [
    {
      "recordType": "D",
      "senderClaimNumber": "12345678901234567890",
      "claimLineNumber": "00001",
      "memberId": "MEM123456789",
      "patientFirstName": "JOHN",
      "patientLastName": "DOE",
      "patientDob": "19800101",
      "procedureCode": "99213",
      "billedAmount": "150.00",
      "allowedAmount": "120.00",
      ...
    }
  ],
  "trailer": {
    "recordType": "T",
    "totalRecords": 100
  },
  "statistics": {
    "totalRecords": 100
  }
}
```

---

### 2. Parse MRX Text

**Endpoint:** `POST /api/mrx/parse-text`

**Description:** Parse MRX file content from raw text

**Request:**

- Method: POST
- Content-Type: text/plain
- Body: Raw MRX file content

**Example (cURL):**

```bash
curl -X POST http://localhost:8080/api/mrx/parse-text \
  -H "Content-Type: text/plain" \
  --data-binary @mrx-sample.txt
```

---

### 3. Parse ACK File (Upload)

**Endpoint:** `POST /api/ack/parse`

**Description:** Upload and parse an ACK file

**Request:**

- Method: POST
- Content-Type: multipart/form-data
- Parameter: `file` (MultipartFile)

**Example (cURL):**

```bash
curl -X POST http://localhost:8080/api/ack/parse \
  -F "file=@ack-sample.txt"
```

**Response:**

```json
{
  "header": {
    "recordType": "H",
    "prime": "PRIME",
    "sender": "BCBSMN",
    "creationDate": "20260213",
    "selectionFromDate": "20260101",
    "selectionToDate": "20260131"
  },
  "dataRecords": [
    {
      "recordType": "D",
      "claimNumber": "12345678901234567890",
      "claimLineNumber": "00001",
      "memberId": "MEM123456789",
      "ackStatus": "A",
      "rejectCode": ""
    },
    {
      "recordType": "D",
      "claimNumber": "98765432109876543210",
      "claimLineNumber": "00002",
      "memberId": "MEM987654321",
      "ackStatus": "R",
      "rejectCode": "EDI3108"
    }
  ],
  "trailer": {
    "recordType": "T",
    "totalRecords": 2
  },
  "statistics": {
    "totalRecords": 2,
    "acceptedCount": 1,
    "rejectedCount": 1
  }
}
```

---

### 4. Parse ACK Text

**Endpoint:** `POST /api/ack/parse-text`

**Description:** Parse ACK file content from raw text

**Request:**

- Method: POST
- Content-Type: text/plain
- Body: Raw ACK file content

---

### 5. Parse RESP File (Upload)

**Endpoint:** `POST /api/resp/parse`

**Description:** Upload and parse a RESP file

**Request:**

- Method: POST
- Content-Type: multipart/form-data
- Parameter: `file` (MultipartFile)

**Example (cURL):**

```bash
curl -X POST http://localhost:8080/api/resp/parse \
  -F "file=@resp-sample.txt"
```

**Response:**

```json
{
  "header": {
    "recordType": "H",
    "prime": "PRIME",
    "sender": "BCBSMN",
    "creationDate": "20260213",
    "selectionFromDate": "20260101",
    "selectionToDate": "20260131"
  },
  "dataRecords": [
    {
      "recordType": "D",
      "claimNumber": "12345678901234567890",
      "claimLineNumber": "00001",
      "mrxClaimNumber": "MRX123456789",
      "allowedAmount": "120.00",
      "unitsApproved": "1",
      "unitsDenied": "0",
      "claimStatus": "PD",
      "denialCode": "",
      "authorizationNumber": "AUTH123",
      "procedureCode": "99213"
    },
    {
      "recordType": "D",
      "claimNumber": "98765432109876543210",
      "claimLineNumber": "00002",
      "mrxClaimNumber": "MRX987654321",
      "allowedAmount": "0.00",
      "unitsApproved": "0",
      "unitsDenied": "1",
      "claimStatus": "DY",
      "denialCode": "GI",
      "authorizationNumber": "",
      "procedureCode": "99214"
    }
  ],
  "trailer": {
    "recordType": "T",
    "totalRecords": 2
  },
  "statistics": {
    "totalRecords": 2,
    "paidCount": 1,
    "deniedCount": 1,
    "partialCount": 0
  }
}
```

---

### 6. Parse RESP Text

**Endpoint:** `POST /api/resp/parse-text`

**Description:** Parse RESP file content from raw text

**Request:**

- Method: POST
- Content-Type: text/plain
- Body: Raw RESP file content

---

## Status Codes

- **200 OK**: Request successful, file parsed
- **400 Bad Request**: Invalid file format or parsing error
- **500 Internal Server Error**: Server error during file processing

## Error Handling

All endpoints return standard HTTP status codes. In case of errors, the response body will be empty or contain error details.

## CORS

CORS is enabled for all origins (`*`) in development mode. Update the `@CrossOrigin` annotation in controllers for production deployment.

## File Format Requirements

### MRX Files

- Fixed-width format
- Record length: 921 characters
- Record types: H (Header), D (Data), T (Trailer)

### ACK Files

- Fixed-width format
- Record length: 220 characters
- Record types: H (Header), D (Data), T (Trailer)
- Status values: A (Accept), R (Reject)

### RESP Files

- Fixed-width format
- Record length: 230 characters
- Record types: H (Header), D (Data), T (Trailer)
- Status values: PD (Paid), DY (Denied), PA (Partial Approval)

## Integration Example (JavaScript/Fetch)

```javascript
// Upload file
const formData = new FormData();
formData.append("file", fileInput.files[0]);

fetch("http://localhost:8080/api/ack/parse", {
  method: "POST",
  body: formData,
})
  .then((response) => response.json())
  .then((data) => {
    console.log("Parsed data:", data);
    console.log("Statistics:", data.statistics);
  })
  .catch((error) => console.error("Error:", error));
```

```javascript
// Parse text content
fetch("http://localhost:8080/api/ack/parse-text", {
  method: "POST",
  headers: {
    "Content-Type": "text/plain",
  },
  body: fileContent,
})
  .then((response) => response.json())
  .then((data) => console.log("Parsed data:", data))
  .catch((error) => console.error("Error:", error));
```
