# API Documentation - File Parser Engine

## Base URL

```
http://localhost:8080
```

## Endpoints (8 Total)

All endpoints are served by the **UnifiedParserController** at `/api`.

---

### 1. Health Check

**Endpoint:** `GET /api/health`

**Description:** Verify backend is running and responsive.

**Response:** `200 OK`

---

### 2. Get Layouts

**Endpoint:** `GET /api/layouts`

**Description:** Returns YAML layout configurations for ACK, RESP, and MRX file types. Used by the frontend to render the data grid dynamically.

**Response:**

```json
{
  "ACK": {
    "name": "ACK",
    "lineLength": 220,
    "header": [...],
    "data": [...],
    "trailer": [...],
    "denialCodes": [...]
  },
  "RESP": { ... },
  "MRX": { ... }
}
```

---

### 3. Parse File (Upload)

**Endpoint:** `POST /api/parse`

**Description:** Upload and auto-detect file type (ACK, RESP, MRX), then parse it. Returns ParseResult-compatible JSON for the frontend.

**Request:**

- Method: POST
- Content-Type: multipart/form-data
- Parameter: `file` (MultipartFile)

**Example (cURL):**

```bash
curl -X POST http://localhost:8080/api/parse \
  -F "file=@sample.txt"
```

**Response:**

```json
{
  "lines": [...],
  "summary": {
    "total": 100,
    "valid": 98,
    "invalid": 2,
    "accepted": 80,
    "rejected": 20
  },
  "detectedSchema": "ACK",
  "rawContent": "..."
}
```

---

### 4. Parse Text

**Endpoint:** `POST /api/parse-text`

**Description:** Parse raw text content with auto-detection of file type.

**Request:**

- Method: POST
- Content-Type: text/plain
- Body: Raw file content

---

### 5. Convert MRX → ACK

**Endpoint:** `POST /api/convert/mrx-to-ack` (or `/api/mrx/convert/ack`)

**Description:** Convert an uploaded MRX file to ACK format.

**Request:**

- Method: POST
- Content-Type: multipart/form-data
- Parameters: `file` (MultipartFile), `timestamp` (String, optional)

**Response:**

```json
{
  "content": "...",
  "fileName": "generated_ack_file.txt"
}
```

---

### 6. Convert MRX → RESP

**Endpoint:** `POST /api/convert/mrx-to-resp` (or `/api/mrx/convert/resp`)

**Description:** Convert an uploaded MRX file to RESP format.

**Request:**

- Method: POST
- Content-Type: multipart/form-data
- Parameters: `file` (MultipartFile), `timestamp` (String, optional)

---

### 7. Convert MRX → CSV

**Endpoint:** `POST /api/convert/mrx-to-csv` (or `/api/mrx/convert/csv`)

**Description:** Convert an uploaded MRX file to CSV format.

**Request:**

- Method: POST
- Content-Type: multipart/form-data
- Parameter: `file` (MultipartFile)

---

### 8. Validate Claim

**Endpoint:** `POST /api/validate`

**Description:** Unified validation endpoint for claim operations. Uses a `type` field to determine which validation to run.

**Request:**

- Method: POST
- Content-Type: application/json

**Type: `STATUS_CHANGE`** — Validates if a claim status change is allowed.

```json
{
  "type": "STATUS_CHANGE",
  "unitsApproved": 5,
  "newStatus": "PA"
}
```

**Type: `PARTIAL_UNITS`** — Validates partial approval unit split.

```json
{
  "type": "PARTIAL_UNITS",
  "totalUnits": 10,
  "newApproved": 7,
  "newDenied": 3
}
```

**Response:**

```json
{
  "isValid": true,
  "error": null,
  "allowedStatuses": ["PD", "PA", "DY"]
}
```

---

## Status Codes

- **200 OK**: Request successful
- **400 Bad Request**: Invalid file format or parsing error
- **500 Internal Server Error**: Server error during processing

## CORS

CORS is enabled for all origins (`*`) in development mode. Update the `@CrossOrigin` annotation for production.

## File Format Requirements

### MRX Files

- Fixed-width format, 921 characters per line
- Record types: H (Header), D (Data), T (Trailer)

### ACK Files

- Fixed-width format, 220 characters per line
- Record types: H (Header), D (Data), T (Trailer)
- Status values: A (Accept), R (Reject)

### RESP Files

- Fixed-width format, 230 characters per line
- Record types: H (Header), D (Data), T (Trailer)
- Status values: PD (Paid), DY (Denied), PA (Partial Approval)
