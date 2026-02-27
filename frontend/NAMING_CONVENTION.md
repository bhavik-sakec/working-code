# Naming Conventions Documentation

This document outlines the primary locations for modifying file naming conventions within the Magellan Response Protocol Suite.

## Primary Source (Backend)

The backend is the authoritative source for generated filenames. To change the naming convention for ACK, RESP, or CSV exports, modify the logic in the Spring Boot controller.

**File Path:**
`file-parser-engine/src/main/java/com/mrx/fileparserengine/controller/UnifiedParserController.java`

### Modification Points:

1. **ACK Files** (around line 116):

   ```java
   "fileName", "TEST.MCMSMN_CLAIMS_ACK_" + timestamp + ".txt"
   ```

   _Change the string prefix as needed._

2. **RESP Files** (around line 151):

   ```java
   "fileName", "TEST.PRIME_BCBSMN_GEN_CLAIMS_RESP_" + timestamp + ".txt"
   ```

   _Change the string prefix as needed._

3. **CSV Exports** (around line 180):
   ```java
   "fileName", "TEST.MCMSMN_CLAIMS_EXPORT_" + timestamp + ".csv"
   ```
   _Change the string prefix as needed._

---

## Secondary/Fallback Logic (Frontend)

The frontend uses the filename provided by the backend. However, if you need to adjust UI-side fallback logic (though now simplified to trust the backend), you can refer to the following:

**File Path:**
`components/mrx-converter.tsx`

### Logic Reference:

The `handleAction` function (around line 181) handles the download triggers:

```tsx
const handleAction = async (type: "ACK" | "RESP" | "CSV") => {
  // ...
  const result = await convertMrxToAckOnBackend(originalFile, mrxTimestamp);
  downloadString(result.content, result.fileName);
  // ...
};
```

---

## Deployment Note

After making changes to the **Backend Controller**:

1. Save the `.java` file.
2. Restart the Spring Boot application to apply the changes.
3. The frontend is reactive and will start receiving the new filenames immediately upon the next request.
