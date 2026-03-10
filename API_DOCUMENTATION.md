# File Parser Engine API Documentation

Base URL: `http://localhost:8080` (or your deployed environment URL)

This document provides a comprehensive guide to all the REST API endpoints available in the File Parser Engine backend, along with instructions on how to test them using Postman.

## Table of Contents
1.  [System Endpoints](#system-endpoints)
2.  [Parsing Endpoints](#parsing-endpoints)
3.  [Conversion Endpoints (Legacy)](#conversion-endpoints-legacy)
4.  [Elite Tier Session Endpoints (Large Files)](#elite-tier-session-endpoints-large-files)
5.  [Validation Endpoints](#validation-endpoints)

---

## System Endpoints

### 1. Health Check
Checks if the application is running.

*   **URL:** `/api/health`
*   **Method:** `GET`
*   **Postman Setup:**
    *   Method: `GET`
    *   URL: `http://localhost:8080/api/health`
    *   Click **Send**.

### 2. Get Layouts
Retrieves all available YAML layout definitions for ACK, RESP, and MRX file types.

*   **URL:** `/api/layouts`
*   **Method:** `GET`
*   **Postman Setup:**
    *   Method: `GET`
    *   URL: `http://localhost:8080/api/layouts`
    *   Click **Send**.

---

## Parsing Endpoints

### 3. Parse File (JSON Response)
Parses an uploaded file (ACK, RESP, or MRX) and returns the entire result as a standard JSON object. **Warning:** Not recommended for files over 100,000 lines as it may cause OutOfMemory errors or browser crashes.

*   **URL:** `/api/parse`
*   **Method:** `POST`
*   **Headers:** `Content-Type: multipart/form-data`
*   **Postman Setup:**
    *   Method: `POST`
    *   URL: `http://localhost:8080/api/parse`
    *   Body -> `form-data`
    *   Key: `file` (Change the type from 'Text' to 'File' using the hidden dropdown on the right side of the Key input box).
    *   Value: Select your `.txt` file.
    *   Click **Send**.

### 4. Parse File (Streaming NDJSON)
Streams the parsed file back to the client line-by-line as NDJSON (Newline Delimited JSON). This is highly memory efficient and recommended for medium-to-large files that don't need random access.

*   **URL:** `/api/parse-stream`
*   **Method:** `POST`
*   **Headers:** `Content-Type: multipart/form-data`
*   **Postman Setup:**
    *   Method: `POST`
    *   URL: `http://localhost:8080/api/parse-stream`
    *   Body -> `form-data`
    *   Key: `file` (Type: `File`).
    *   Value: Select your `.txt` file.
    *   Click **Send**.

### 5. Parse Raw Text
Parses raw string content sent in the request body. Useful for small snippets or clipboard data.

*   **URL:** `/api/parse-text`
*   **Method:** `POST`
*   **Headers:** `Content-Type: text/plain` (or application/json depending on how you send the body)
*   **Postman Setup:**
    *   Method: `POST`
    *   URL: `http://localhost:8080/api/parse-text`
    *   Body -> `raw` -> Make sure the dropdown says `Text`.
    *   Paste the raw lines of your file.
    *   Click **Send**.

---

## Elite Tier Session Endpoints (Large Files)

These endpoints implement the "1BRC Hybrid Architecture" mapping files into server memory for O(1) random access, enabling sorting, streaming, and editing of 1M+ line files.

### 6. Initialize Session
Uploads a file, maps it into server memory, starts a background indexing process, and returns a `sessionId`.

*   **URL:** `/api/session/init`
*   **Method:** `POST`
*   **Headers:** `Content-Type: multipart/form-data`
*   **Postman Setup:**
    *   Method: `POST`
    *   URL: `http://localhost:8080/api/session/init`
    *   Body -> `form-data`
    *   Key: `file` (Type: `File`).
    *   Value: Select your large `.txt` file.
    *   Click **Send**.
    *   **Keep note of the `sessionId` returned in the JSON!**

### 7. Get Session Status
Polls the background indexing status of an active session.

*   **URL:** `/api/session/{sessionId}/status`
*   **Method:** `GET`
*   **Postman Setup:**
    *   Method: `GET`
    *   URL: `http://localhost:8080/api/session/YOUR_SESSION_ID/status`
    *   Click **Send**.

### 8. Get Session Rows
Fetches a specific chunk (page) of rows from the indexed file. Fast O(1) random access.

*   **URL:** `/api/session/{sessionId}/rows`
*   **Method:** `GET`
*   **Query Parameters:**
    *   `start` (Optional, default 0): The index of the first row to fetch.
    *   `limit` (Optional, default 200): The number of rows to fetch.
*   **Postman Setup:**
    *   Method: `GET`
    *   URL: `http://localhost:8080/api/session/YOUR_SESSION_ID/rows?start=500&limit=100`
    *   Click **Send**.

### 9. Batch Execute
Randomizes and updates claim statuses in the file based on percentages/counts. Returns updated summary statistics.

*   **URL:** `/api/session/{sessionId}/batch-execute`
*   **Method:** `POST`
*   **Headers:** `Content-Type: application/json`
*   **Body Example:**
    ```json
    {
      "mode": "RESP_DENY",
      "pct": 10,
      "randomizeCodes": true
    }
    ```
*   **Postman Setup:**
    *   Method: `POST`
    *   URL: `http://localhost:8080/api/session/YOUR_SESSION_ID/batch-execute`
    *   Body -> `raw` -> `JSON`.
    *   Paste the JSON configuration above.
    *   Click **Send**.

### 10. Export Session File
Downloads the fully modified text file representing the current state of the session.

*   **URL:** `/api/session/{sessionId}/export`
*   **Method:** `GET`
*   **Postman Setup:**
    *   Method: `GET`
    *   URL: `http://localhost:8080/api/session/YOUR_SESSION_ID/export`
    *   Click **Send**. (Postman might try to display the text in the response window. Clicking "Save Response -> Save to a file" will let you download it).

### 11. Cancel Session
Forces the termination of an active session and cleans up its temporary files from the server.

*   **URL:** `/api/session/{sessionId}`
*   **Method:** `DELETE`
*   **Postman Setup:**
    *   Method: `DELETE`
    *   URL: `http://localhost:8080/api/session/YOUR_SESSION_ID`
    *   Click **Send**.

---

## Conversion Endpoints (Legacy)

*Note: These are older endpoints mainly used by the Prepay MRx Forge UI that do conversion eagerly.*

### 12. Convert MRX to ACK
*   **URL:** `/api/convert/mrx-to-ack` (or `/api/mrx/convert/ack`)
*   **Method:** `POST`
*   **Headers:** `Content-Type: multipart/form-data`
*   **Postman Setup:** Form-data with `file` key. Optional keys: `timestamp`, `rejectPercentage`, `rejectCount`, `randomizeRejectCodes`.

### 13. Convert MRX to RESP
*   **URL:** `/api/convert/mrx-to-resp` (or `/api/mrx/convert/resp`)
*   **Method:** `POST`
*   **Headers:** `Content-Type: multipart/form-data`
*   **Postman Setup:** Form-data with `file` key. Optional keys: `timestamp`, `denyPercentage`, `denyCount`, `denialCode`, `partialPercentage`, `partialCount`, `partialApprovedPercent`, `randomizeDenialCodes`.

### 14. Convert MRX to CSV
*   **URL:** `/api/convert/mrx-to-csv` (or `/api/mrx/convert/csv`)
*   **Method:** `POST`
*   **Headers:** `Content-Type: multipart/form-data`
*   **Postman Setup:** Form-data with `file` key. Optional keys: `timestamp`.

---

## Validation Endpoints

### 15. Validate Claim Operation
Validates if a certain business logic operation (like a status change or partial unit split) is allowed under the current rules.

*   **URL:** `/api/validate`
*   **Method:** `POST`
*   **Headers:** `Content-Type: application/json`
*   **Body Example:**
    ```json
    {
      "type": "STATUS_CHANGE",
      "unitsApproved": 1,
      "totalUnits": 5,
      "newStatus": "PA"
    }
    ```
*   **Postman Setup:**
    *   Method: `POST`
    *   URL: `http://localhost:8080/api/validate`
    *   Body -> `raw` -> `JSON`.
    *   Paste the JSON configuration above.
    *   Click **Send**.
