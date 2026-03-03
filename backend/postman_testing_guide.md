# Postman API Testing Guide - File Parser Engine

This guide provides a structured approach to testing the **File Parser Engine** backend using Postman. It covers manual testing, automated assertions, and environment management.

## 1. Setup Environment

Using environments allows you to switch between `Local`, `Staging`, and `Production` without changing individual requests.

1.  Click the **Environments** tab on the left.
2.  Click **+** to create a new environment.
3.  Name it: `FileParser - Local`.
4.  Add the following variables:
    | Variable | Initial Value | Current Value |
    | :--- | :--- | :--- |
    | `base_url` | `http://localhost:8080` | `http://localhost:8080` |
    | `api_path` | `/api` | `/api` |

---

## 2. Create Collection Structure

Organize your requests to match the API structure.

1.  Click **Collections** > **+** > **Blank Collection**.
2.  Name it: `File Parser Engine API`.
3.  Add folders:
    - `System` (Health check)
    - `Configuration` (Layouts)
    - `Parsing` (Upload / Text)
    - `Conversion` (MRX → ACK/RESP/CSV)
    - `Validation` (Business Logic)

---

## 3. Detailed Request Configurations

> [!TIP]
> **How to add these to Postman:**
>
> 1. Create a new Request and paste the **URL**.
> 2. For scripts: Click the **Tests** tab (located just below the URL bar).
> 3. Paste the provided **JavaScript code** into the editor.
> 4. Click **Send**.
> 5. View results in the **Test Results** tab in the bottom response pane.
>
> [!IMPORTANT]
> **The Secret "file" Key:**
> For all **Upload** or **Conversion** requests (C, E, F, G), your Body -> form-data key **MUST** be named exactly **`file`** (lowercase). If you use `fileName` or anything else, you will get a "Missing part 'file'" error.

### A. Health Check (GET)

- **URL:** `{{base_url}}{{api_path}}/health`
- **Tests:**
  ```javascript
  pm.test("Status is 200", () => pm.response.to.have.status(200));
  pm.test("Engine check", () =>
    pm.expect(pm.response.json().engine).to.eql("MAGELLAN-FORGE-V1"),
  );
  ```

### B. Get Layouts (GET)

- **URL:** `{{base_url}}{{api_path}}/layouts`
- **Tests:**
  ```javascript
  pm.test("Layouts returned", () => {
    const data = pm.response.json();
    pm.expect(data).to.have.property("ACK");
    pm.expect(data).to.have.property("MRX");
  });
  ```

### C. Parse File (POST Multipart)

- **URL:** `{{base_url}}{{api_path}}/parse`
- **Body:** `form-data`
  - `file`: (Select ACK/RESP/MRX file)
- **Tests:**
  ```javascript
  pm.test("Parse Success", () => pm.response.to.have.status(200));
  pm.test("Detected Schema", () =>
    pm.expect(pm.response.json().detectedSchema).to.not.eql("INVALID"),
  );
  ```

### D. Parse Text (POST Plain Text)

- **URL:** `{{base_url}}{{api_path}}/parse-text`
- **Header:** `Content-Type: text/plain`
- **Body:** `raw` (Paste your file content here)
- **Tests:** Same as Parse File.

### E. Convert MRX → ACK (POST Multipart)

- **URL:** `{{base_url}}{{api_path}}/convert/mrx-to-ack`
- **Body:** `form-data`
  - `file`: (Select MRX file)
  - `timestamp`: `20260227` (Optional)
- **Tests:**
  ```javascript
  pm.test("Conversion Success", () => {
    const data = pm.response.json();
    pm.expect(data.fileName).to.include(".txt");
  });
  ```

### F. Convert MRX → RESP (POST Multipart)

- **URL:** `{{base_url}}{{api_path}}/convert/mrx-to-resp`
- **Body:** Same as MRX → ACK.
- **Tests:** Same as MRX → ACK (Checks for `.txt` in `fileName`).

### G. Convert MRX → CSV (POST Multipart)

- **URL:** `{{base_url}}{{api_path}}/convert/mrx-to-csv`
- **Body:** `form-data`
  - `file`: (Select MRX file)
- **Tests:**
  ```javascript
  pm.test("CSV Export Success", () => {
    const data = pm.response.json();
    pm.expect(data.fileName).to.include(".csv");
  });
  ```

### H. Validate Claim (POST JSON)

- **URL:** `{{base_url}}{{api_path}}/validate`
- **Body:** `raw` -> `JSON`
  - **Status Change Example:**
    ```json
    {
      "type": "STATUS_CHANGE",
      "unitsApproved": 5,
      "totalUnits": 10,
      "newStatus": "PA"
    }
    ```
  - **Partial Units Example:**
    ```json
    {
      "type": "PARTIAL_UNITS",
      "totalUnits": 10,
      "newApproved": 7,
      "newDenied": 3
    }
    ```
  - **Full Denial Example:**
    ```json
    {
      "type": "STATUS_CHANGE",
      "unitsApproved": 5, // Currently some units approved
      "totalUnits": 5,
      "newStatus": "DY" // Change to Denied
    }
    ```
  - **Blocked Denial Example (Redundant):**
    ```json
    {
      "type": "STATUS_CHANGE",
      "unitsApproved": 0, // Already at 0
      "totalUnits": 5,
      "newStatus": "DY" // Trying to change to DY again
    }
    ```
- **Tests:**

  ```javascript
  pm.test("Response is valid JSON and successful", () => {
    pm.expect(pm.response.json()).to.have.property("isValid");
  });

  // Example Logic: Testing Deny (DY) specifically
  const req = pm.request.json();
  const res = pm.response.json();

  if (req.newStatus === "DY") {
    pm.test("Denial Logic: Suggested Approved should be 0", () => {
      pm.expect(res.suggestedApproved).to.eql(0);
      pm.expect(res.suggestedDenied).to.eql(req.totalUnits);
    });
  }

  // Example Edge Case: Blocking DY if already 0 approved
  if (req.newStatus === "DY" && req.unitsApproved === 0) {
    pm.test("Edge Case: Status Change Blocked for redundant DY", () => {
      pm.expect(res.isValid).to.be.false;
      pm.expect(res.error).to.include("units are 0");
    });
  }
  ```

---

## 4. Automated Testing Best Practices

### Pre-request Scripts

Use these to generate dynamic data or timestamps if needed.

```javascript
// Example: Add a timestamp to environment
pm.environment.set("current_timestamp", new Date().toISOString());
```

### Collection Runner

1.  Click the three dots `...` next to the collection name.
2.  Select **Run collection**.
3.  Choose your environment (`FileParser - Local`).
4.  Click **Run File Parser Engine API**.
    - _This will run all saved tests across all endpoints and give you a pass/fail report._

---

## 5. Troubleshooting Tips

- **Multipart Errors:** If you get a `400 Bad Request` with "Request must be sent as multipart/form-data", ensure you are using the **Body > form-data** tab and NOT the binary or raw tabs.
- **CORS Issues:** If testing from a browser-based Postman or a custom client, the backend is configured to allow `*` (all origins), but ensure no proxies are stripping headers.
- **File Encoding:** The backend expects `UTF-8`. Ensure your test files (MRX/ACK) are saved with matching encoding.

---

## 6. Performance Testing

Postman (v10+) includes a built-in performance testing tool to simulate concurrent users.

### A. How to Access

1.  **Use Desktop App**: Performance testing is only available in the Postman Desktop application (not the web version).
2.  **Open Collection Runner**: Click on your `File Parser Engine API` collection and click **Run**.
3.  **Switch Tab**: In the Runner window, select the **Performance** tab.

### B. Configuration

1.  **Virtual Users (VUs)**: Set how many concurrent users you want to simulate (e.g., `10` or `20`).
2.  **Duration**: Set the total test time (e.g., `2 minutes`).
3.  **Load Profile**:
    - **Fixed**: A steady number of VUs hit the API continuously.
    - **Ramp-up**: Gradually increase VUs from 0 to your maximum (best for testing local server stability).

### C. Performance Tips

> [!IMPORTANT]
> **Avoid Request C, E, F, G during Performance Tests:**
> Postman's performance runner **does not support multipart file uploads**.

> 💡 **The Performance Secret:** Use the **Parse Text (Request D)** endpoint for your performance tests. It uses raw text strings in the body, which Postman handles perfectly during load tests.

### D. Key Metrics

- **Avg. Response Time**: For the File Parser Engine, aim for `< 500ms` even under load.
- **Throughput**: How many requests per second the engine handles before slowing down.
- **Error Rate**: If this rises above `0%`, decrease your VUs or check your local server resources.
