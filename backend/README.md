# File Parser Engine - Java Spring Boot Backend

A robust Java Spring Boot backend for parsing fixed-width MRX, ACK, and RESP files used in healthcare claim processing.

## 🚀 Features

- **MRX File Parsing**: Parse 921-character fixed-width MRX claim files
- **ACK File Parsing**: Parse 220-character acknowledgment files with accept/reject tracking
- **RESP File Parsing**: Parse 220-character response files with paid/denied/partial status tracking
- **REST API**: Clean RESTful endpoints for file upload and text parsing
- **Statistics**: Automatic calculation of file statistics (accepted, rejected, paid, denied, etc.)
- **CORS Enabled**: Ready for frontend integration

## 📋 Prerequisites

- Java 21 or higher
- Gradle 8.x

## 🛠️ Installation

1. Navigate to the project directory:

```bash
cd file-parser-engine
```

2. Build the project:

```bash
./gradlew build
```

## ▶️ Running the Application

Start the Spring Boot application:

```bash
./gradlew bootRun
```

The server will start on `http://localhost:8080`

## 📡 API Endpoints

All endpoints are served at the base path `/api`. The system uses auto-detection to handle ACK, RESP, and MRX files automatically.

### Parsing Operations

**Upload and Parse File:**

```
POST /api/parse
Content-Type: multipart/form-data
Parameter: file (MultipartFile)
```

**Parse Raw Text:**

```
POST /api/parse-text
Content-Type: text/plain
Body: Raw file content
```

### Conversion Operations (MRX Only)

**Convert MRX to ACK:**

```
POST /api/convert/mrx-to-ack
Content-Type: multipart/form-data
Parameter: file (MultipartFile)
```

**Convert MRX to RESP:**

```
POST /api/convert/mrx-to-resp
Content-Type: multipart/form-data
Parameter: file (MultipartFile)
```

**Convert MRX to CSV:**

```
POST /api/convert/mrx-to-csv
Content-Type: multipart/form-data
Parameter: file (MultipartFile)
```

### Business Validation

**Validate Claim Data:**

```
POST /api/validate
Content-Type: application/json
```

## 📊 Response Format

All endpoints return JSON responses with the following structure:

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
      ...
    }
  ],
  "trailer": {
    "recordType": "T",
    "totalRecords": 100
  },
  "statistics": {
    "totalRecords": 100,
    "acceptedCount": 85,
    "rejectedCount": 15,
    "paidCount": 70,
    "deniedCount": 20,
    "partialCount": 10
  }
}
```

## 🏗️ Project Structure

```
src/main/java/com/mrx/fileparserengine/
├── controller/          # Unified REST Controller
│   └── UnifiedParserController.java
├── service/            # Business logic services
│   ├── UnifiedParserService.java
│   └── LayoutLoaderService.java
├── model/              # Data models
│   └── FileLayout.java
├── dto/                # Data Transfer Objects
│   ├── UnifiedParseResponse.java
│   └── ...
└── util/               # Utility classes
```

## 🔧 Configuration

Edit `src/main/resources/application.properties` to customize:

- Server port (default: 8080)
- File upload limits (default: 10MB)
- Logging levels

## 🧪 Testing with cURL

**Test File Parsing:**

```bash
curl -X POST http://localhost:8080/api/parse \
  -F "file=@path/to/your-file.txt"
```

**Test Conversion (MRX to ACK):**

```bash
curl -X POST http://localhost:8080/api/convert/mrx-to-ack \
  -F "file=@path/to/mrx-file.txt"
```

## 📝 File Format Specifications

### MRX File

- **Record Length**: 921 characters
- **Record Types**: H (Header), D (Data), T (Trailer)
- **Purpose**: Inbound claim file sent to MRx/Prime

### ACK File

- **Record Length**: 220 characters
- **Record Types**: H (Header), D (Data), T (Trailer)
- **Purpose**: Acknowledgment file with Accept/Reject status
- **Status Values**: A (Accept), R (Reject)

### RESP File

- **Record Length**: 230 characters
- **Record Types**: H (Header), D (Data), T (Trailer)
- **Purpose**: Adjudication response file
- **Status Values**: PD (Paid), DY (Denied), PA (Partial Approval)

## 🤝 Integration with Frontend

This backend is designed to work seamlessly with the Next.js frontend in the parent directory. The CORS configuration allows requests from any origin during development.

For production, update the `@CrossOrigin` annotation in controllers to specify allowed origins.

## 🏷️ Naming Conventions

### File Download Naming

Whenever a file is generated for download (e.g., via the conversion endpoints), the backend suggests a naming convention. If you need to modify these patterns, refer to the following methods in `UnifiedParserService.java`:

- **ACK Files**: Generated as `BCBSMN_PRIME_CLAIMS_{TIMESTAMP}.txt`. See `convertMrxToAck()`.
- **RESP Files**: Naming is typically driven by the header record content or dynamic logic in the conversion methods. See `convertMrxToResp()`.
- **CSV Exports**: While the CSV structure is generated in `convertMrxToCsv()`, the download filename is often managed by the frontend implementation.

> [!TIP]
> To change the default prefix or date format, search for hardcoded strings (like "BCBSMN") in the `UnifiedParserService` methods and update the `pad()` calls accordingly.

## 📄 License

This project is part of the Magellan Response system.
