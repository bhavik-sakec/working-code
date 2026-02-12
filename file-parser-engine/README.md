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

### MRX File Parsing

**Upload MRX File:**

```
POST /api/mrx/parse
Content-Type: multipart/form-data
Parameter: file (MultipartFile)
```

**Parse MRX Text:**

```
POST /api/mrx/parse-text
Content-Type: text/plain
Body: Raw MRX file content
```

### ACK File Parsing

**Upload ACK File:**

```
POST /api/ack/parse
Content-Type: multipart/form-data
Parameter: file (MultipartFile)
```

**Parse ACK Text:**

```
POST /api/ack/parse-text
Content-Type: text/plain
Body: Raw ACK file content
```

### RESP File Parsing

**Upload RESP File:**

```
POST /api/resp/parse
Content-Type: multipart/form-data
Parameter: file (MultipartFile)
```

**Parse RESP Text:**

```
POST /api/resp/parse-text
Content-Type: text/plain
Body: Raw RESP file content
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
├── controller/          # REST API controllers
│   ├── MrxController.java
│   ├── AckController.java
│   └── RespController.java
├── service/            # Business logic services
│   ├── MrxParserService.java
│   ├── AckParserService.java
│   └── RespParserService.java
├── model/              # Data models
│   ├── HeaderRecord.java
│   ├── TrailerRecord.java
│   ├── MrxDataRecord.java
│   ├── AckDataRecord.java
│   └── RespDataRecord.java
├── dto/                # Data Transfer Objects
│   ├── MrxFileResponse.java
│   ├── AckFileResponse.java
│   ├── RespFileResponse.java
│   └── FileStatistics.java
└── util/               # Utility classes
    ├── FixedWidthParser.java
    └── DateUtil.java
```

## 🔧 Configuration

Edit `src/main/resources/application.properties` to customize:

- Server port (default: 8080)
- File upload limits (default: 10MB)
- Logging levels

## 🧪 Testing with cURL

**Test MRX parsing:**

```bash
curl -X POST http://localhost:8080/api/mrx/parse \
  -F "file=@path/to/mrx-file.txt"
```

**Test ACK parsing:**

```bash
curl -X POST http://localhost:8080/api/ack/parse \
  -F "file=@path/to/ack-file.txt"
```

**Test RESP parsing:**

```bash
curl -X POST http://localhost:8080/api/resp/parse \
  -F "file=@path/to/resp-file.txt"
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

## 📄 License

This project is part of the Magellan Response system.
