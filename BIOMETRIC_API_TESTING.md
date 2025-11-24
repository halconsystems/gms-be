# Biometric API Testing Guide

**Document Version:** 2.0 (Enhanced with DTO Transformation Details)  
**Last Updated:** November 12, 2025  
**Audience:** QA Engineers, Backend Developers, DevOps Engineers  

---

## Table of Contents

0. [DTO Transformation Pipeline](#dto-transformation-pipeline)
1. [Environment Setup](#environment-setup)
2. [Agent Health Check Endpoint](#agent-health-check-endpoint)
3. [Capture Fingerprint Endpoint](#capture-fingerprint-endpoint)
4. [Save Fingerprint Endpoint](#save-fingerprint-endpoint)
5. [DTO Validation Testing](#dto-validation-testing)
6. [FileService Integration](#fileservice-integration)
7. [Error Handling & Logging](#error-handling--logging)
8. [Swagger Documentation](#swagger-documentation)
9. [Concurrent Request Handling](#concurrent-request-handling)
10. [Performance & Load Testing](#performance--load-testing)
11. [Regression Testing](#regression-testing)

---

## DTO Transformation Pipeline

### Understanding String-to-Number Conversion

The fingerprint agent (`localhost:8765`) expects numeric parameters, but JSON payloads from the frontend may send numbers as strings (e.g., `"0"` instead of `0`). The NestJS validation pipeline must transform these strings to numbers before the agent processes them.

**Error Indicating Transformation Failure**: `Expected 2 arguments, got 1`

### Transformation Architecture

```
Frontend JSON Payload
    ↓
    {"deviceIndex":"0","maxRetries":"3","timeout":"15000"}
    ↓
HTTP Request to Backend
    ↓
Global ValidationPipe (main.ts lines 28-38)
    ├─ transform: true (CRITICAL)
    └─ enableImplicitConversion: true (CRITICAL)
    ↓
@Type(() => Number) Decorators Applied
    ├─ Converts "0" → 0 (string to number)
    ├─ Converts "3" → 3
    └─ Converts "15000" → 15000
    ↓
Validation Decorators Applied
    ├─ @IsNumber() ensures value is numeric
    ├─ @Min(@Max decorators validate range
    └─ @IsOptional allows omission
    ↓
Controller Receives Fully-Typed DTO
    └─ deviceIndex: 0 (type: number)
    └─ maxRetries: 3 (type: number)
    └─ timeout: 15000 (type: number)
    ↓
Service Defensive Normalization Layer
    └─ Additional Number() conversion as safety net
    ↓
Agent Receives Numeric Parameters
    └─ Validates Number.isInteger(deviceIndex)
    └─ Processes successfully
```

### Critical Configuration Points

**1. Global ValidationPipe (gms-be/src/main.ts)**
```typescript
app.useGlobalPipes(
  new ValidationPipe({
    transform: true,                    // ✅ MUST be true
    enableImplicitConversion: true,     // ✅ MUST be true (enables "0" → 0)
    whitelist: true,
    forbidNonWhitelisted: true,
    disableErrorMessages: false,
  }),
);
```

**2. DTO @Type Decorators (gms-be/src/biometric/dto/capture-fingerprint.dto.ts)**
```typescript
@Type(() => Number)           // ✅ FIRST: Explicit transformation
@IsOptional()                 // ✅ SECOND: Mark optional
@IsNumber()                   // ✅ THIRD: Validate number type
@Min(0) @Max(10)              // ✅ FOURTH: Validate range
deviceIndex?: number = 0;     // ✅ FIFTH: Field with default
```

**3. Decorator Ordering Matters**
- `@Type` must come FIRST (before validation)
- `@IsOptional` before `@IsNumber` (optional fields can't fail number check)
- Min/Max after type validation (validates numeric ranges)

### Test Cases for Transformation Verification

#### Test A: String Numbers (Most Important)
```bash
curl -X POST http://localhost:5001/biometric/capture-fingerprint \
  -H "Content-Type: application/json" \
  -d '{"deviceIndex":"0","maxRetries":"3","timeout":"15000"}'
```

**Check Backend Logs:**
- [ ] Should show: `DTO Values: deviceIndex: 0 (type: number)`
- [ ] NOT: `DTO Values: deviceIndex: "0" (type: string)`
- [ ] Agent should accept request (no "Expected 2 arguments" error)

#### Test B: Native Numbers
```bash
curl -X POST http://localhost:5001/biometric/capture-fingerprint \
  -H "Content-Type: application/json" \
  -d '{"deviceIndex":0,"maxRetries":3,"timeout":15000}'
```

**Expected:** Works the same as Test A (numbers already correct type)

#### Test C: Out-of-Range Numbers
```bash
curl -X POST http://localhost:5001/biometric/capture-fingerprint \
  -H "Content-Type: application/json" \
  -d '{"deviceIndex":"999"}'
```

**Expected:** 400 Bad Request with validation error about exceeding max value

#### Test D: Invalid Type (Non-Numeric String)
```bash
curl -X POST http://localhost:5001/biometric/capture-fingerprint \
  -H "Content-Type: application/json" \
  -d '{"deviceIndex":"abc"}'
```

**Expected:** 400 Bad Request - transformation fails for non-numeric strings

### Dependency Requirements

For DTO transformation to work, verify these versions in `package.json`:

```json
{
  "dependencies": {
    "@nestjs/common": "^11.0.1",
    "class-transformer": "^0.5.1",     // ✅ Must be 0.5.1 or compatible
    "class-validator": "^0.14.2"       // ✅ Must be 0.14.2 or compatible
  }
}
```

**Verify Installed Versions:**
```bash
npm ls class-transformer class-validator
# Expected output shows 0.5.1 and 0.14.2
```

### Troubleshooting Transformation Failures

| Symptom | Root Cause | Check |
|---------|-----------|-------|
| Agent error: "Expected 2 arguments, got 1" | Backend sent strings to agent | Verify global ValidationPipe has `transform: true` |
| Backend logs show type: "string" | DTO @Type decorators not applied | Ensure @Type is first decorator |
| 400 validation errors on all requests | Validator too strict or @Type missing | Check DTO decorator ordering |
| "abc" accepted as 0 | Implicit conversion too aggressive | Review enableImplicitConversion setting |

### Multi-Layer Defense Strategy

The system uses three layers of protection:

**Layer 1: Global ValidationPipe (main.ts)**
- Primary transformation mechanism
- Applies @Type decorators from DTO
- Most reliable when working correctly

**Layer 2: Service-Level Normalization (biometric.service.ts)**
- Defensive safety net
- Explicit Number() conversion before agent call
- Catches any edge cases pipe might miss

**Layer 3: Agent Input Validation (fingerprint.js)**
- Agent also converts string inputs to numbers
- Final validation before hardware interaction
- Prevents type errors at lowest level

---

## DTO Transformation Verification

This section tests that the `@Type(() => Number)` decorators in `CaptureFingerprintDto` correctly transform JSON string values to numbers.

### Test 1: String Numbers Transform to Numbers

**Objective**: Verify the pipeline converts string input `{"deviceIndex":"0","maxRetries":"3","timeout":"15000"}` to numeric types.

**Request** (with string values):
```bash
curl -X POST http://localhost:5001/biometric/capture-fingerprint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"deviceIndex":"0","maxRetries":"3","timeout":"15000"}'
```

**Expected Backend Logs**:
- ✅ No validation errors
- ✅ Service receives: `{deviceIndex: 0, maxRetries: 3, timeout: 15000}` (numbers)
- ✅ Agent receives numeric payload
- ❌ **NOT** "Expected 2 arguments, got 1" error

**Expected Response**:
- ✅ 200 OK with fingerprint data (if finger placed on scanner)
- ✅ 400 with specific agent error message (e.g., "Fingerprint acquisition timeout (15000ms exceeded)" if no finger)
- ❌ **NOT** 400 with generic "Expected 2 arguments, got 1"

**Backend Log Example** (Success):
```
[2025-11-17] [INFO] POST /biometric/capture-fingerprint
[2025-11-17] [DEBUG] Raw DTO before normalization: {"deviceIndex":0,"maxRetries":3,"timeout":15000}
[2025-11-17] [LOG] Capturing fingerprint with config: {"deviceIndex":0,"maxRetries":3,"timeout":15000}
[2025-11-17] [DEBUG] Proxying to agent at http://localhost:8765/fingerprint/capture
[2025-11-17] [LOG] Fingerprint captured successfully
```

---

### Test 2: Actual Numbers Pass Through

**Objective**: Verify transformation is idempotent (numeric values pass through unchanged).

**Request** (with numeric values):
```bash
curl -X POST http://localhost:5001/biometric/capture-fingerprint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"deviceIndex":0,"maxRetries":3,"timeout":15000}'
```

**Expected**: Same behavior as Test 1 (transformation is idempotent for numbers).

**Verification**:
- ✅ Backend logs show numeric types
- ✅ Response successful
- ✅ No difference between string and numeric input results

---

### Test 3: Invalid Types Rejected

**Objective**: Verify non-numeric strings are properly rejected by validation.

**Request** (invalid string values):
```bash
curl -X POST http://localhost:5001/biometric/capture-fingerprint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"deviceIndex":"invalid","maxRetries":"abc","timeout":"xyz"}'
```

**Expected Response** (HTTP 400):
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "deviceIndex",
        "message": "deviceIndex must be a number"
      },
      {
        "field": "maxRetries",
        "message": "maxRetries must be a number"
      },
      {
        "field": "timeout",
        "message": "timeout must be a number"
      }
    ]
  }
}
```

**Verification**:
- ✅ HTTP 400 (Bad Request) returned
- ✅ Validation errors clearly identify problematic fields
- ✅ Each field shows specific validation failure reason

---

### Test 4: Out-of-Range Values Rejected

**Objective**: Verify range validation (@Min, @Max decorators) enforces boundaries.

**Request** (out-of-range values):
```bash
curl -X POST http://localhost:5001/biometric/capture-fingerprint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"deviceIndex":99,"maxRetries":0,"timeout":500}'
```

**Expected Response** (HTTP 400):
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "deviceIndex",
        "message": "deviceIndex must not be greater than 10"
      },
      {
        "field": "maxRetries",
        "message": "maxRetries must not be less than 1"
      },
      {
        "field": "timeout",
        "message": "timeout must not be less than 1000"
      }
    ]
  }
}
```

**Verification**:
- ✅ HTTP 400 (Bad Request) returned
- ✅ Range limits enforced (deviceIndex: 0-10, maxRetries: 1-10, timeout: 1000-30000)
- ✅ Specific boundary violation indicated in each error

---

### Troubleshooting Transformation Failures

If strings don't convert to numbers or validation fails unexpectedly:

#### 1. Check Global Pipe Configuration

**File**: `gms-be/src/main.ts`

**Verify**:
```typescript
app.useGlobalPipes(
  new ValidationPipe({
    transform: true,                    // ✅ MUST be true
    enableImplicitConversion: true,     // ✅ MUST be true
    whitelist: true,
    forbidNonWhitelisted: true,
    disableErrorMessages: false,
  }),
);
```

**If Missing**:
- Add `transform: true` and `enableImplicitConversion: true`
- Restart backend: `npm run start:dev`

#### 2. Verify Dependencies

**Check Installed Versions**:
```bash
npm ls class-transformer class-validator
```

**Expected Output**:
```
├── class-transformer@0.5.1
└── class-validator@0.14.2
```

**If Versions Mismatch**:
```bash
# Remove and reinstall
rm -rf node_modules package-lock.json
npm install

# Verify again
npm ls class-transformer class-validator
```

#### 3. Add Debug Logging to Controller

**File**: `gms-be/src/biometric/biometric.controller.ts`

**Add After Line 47**:
```typescript
console.log('DTO received in controller:', dto);
console.log('DTO types:', {
  deviceIndex: typeof dto.deviceIndex,
  maxRetries: typeof dto.maxRetries,
  timeout: typeof dto.timeout
});
```

**Test**:
```bash
# Send request and check console output
curl -X POST http://localhost:5001/biometric/capture-fingerprint \
  -H "Content-Type: application/json" \
  -d '{"deviceIndex":"0","maxRetries":"3","timeout":"15000"}'

# Expected console output:
# DTO received in controller: { deviceIndex: 0, maxRetries: 3, timeout: 15000 }
# DTO types: { deviceIndex: 'number', maxRetries: 'number', timeout: 'number' }
```

**Remove Log After Verification**:
- Delete the debug console.log statements
- Restart backend

#### 4. Check Request Body Parser

**File**: `gms-be/src/main.ts`

**Verify** (Line 16):
```typescript
app.use(bodyParser.json({ limit: '50mb' }));
```

**If Using Different Parser**:
- Ensure it properly parses JSON
- Verify it doesn't interfere with ValidationPipe
- Common issue: Multiple body parsers with conflicting configurations

#### 5. Test Transformation with Frontend

**Steps**:
1. Open browser
2. Navigate to Guards Registration > Bio-Metric
3. Open DevTools (F12)
4. Go to Network tab
5. Click "👆 Scan" button
6. Filter network requests for `/capture-fingerprint`
7. Click the request
8. Go to "Payload" tab

**Inspect**:
- ✅ Should show `deviceIndex: 0` (number, not "0" string)
- ✅ Should show `maxRetries: 3` (number)
- ✅ Should show `timeout: 15000` (number)

**If Shows Strings**:
- Frontend is sending strings
- Frontend DTO also needs `@Type(() => Number)` decorators
- Check `gms-fe-js` frontend DTO if it exists

---

### Success Criteria Checklist

After implementing all verifications, confirm:

- ✅ Backend logs show `typeof deviceIndex === 'number'` (not "string")
- ✅ No "Expected 2 arguments" errors in any logs
- ✅ Agent receives valid numeric payload
- ✅ Invalid inputs rejected with 400 + validation errors
- ✅ Out-of-range values rejected with boundary messages
- ✅ E2E flow works: Capture Fingerprint → Confirmation Modal → Save to S3
- ✅ Multiple tests pass consistently without intermittent failures
- ✅ `npm run start:dev` completes without errors

---

## Environment Setup

### Backend Service Prerequisites

Before testing, verify the backend environment:

- [ ] **Node.js Version**: v16.0.0+
  ```bash
  node --version
  ```

- [ ] **NestJS Version**: v11.x
  ```bash
  npm ls @nestjs/core
  ```

- [ ] **Dependencies Installed**: All required packages
  ```bash
  npm ls | grep -E "(axios|prisma|aws-sdk)"
  ```

- [ ] **Database Connection**: Prisma connected
  ```bash
  npx prisma db validate
  # Expected: ✓ Connection successful
  ```

### Configuration Validation

1. **Verify `.env` File**
   ```bash
   cat .env | grep -E "(AGENT|AWS|DATABASE|PORT)"
   ```
   
   Checklist:
   - [ ] `AGENT_URL=http://127.0.0.1:8765` (local agent)
   - [ ] `AGENT_TIMEOUT=15000` (milliseconds)
   - [ ] `AWS_S3_BUCKET` configured
   - [ ] `AWS_REGION` correct
   - [ ] `DATABASE_URL` valid
   - [ ] `APP_PORT=3000` (or configured)

2. **Agent Service Running**
   ```bash
   curl http://127.0.0.1:8765/health
   # Expected: {"status":"healthy",...}
   ```

3. **Database Migrations Applied**
   ```bash
   npx prisma migrate status
   # Expected: All migrations applied
   ```

### Test Data Preparation

Create test user record:

```bash
# Using Prisma Studio
npx prisma studio

# Or via seed script
npm run seed
```

---

## Agent Health Check Endpoint

**Endpoint**: `GET /biometric/agent-health`

**Objective**: Verify backend can communicate with fingerprint agent

### Test 2.1: Successful Agent Health Check

**Request**:
```bash
curl -X GET http://localhost:3000/biometric/agent-health \
  -H "Content-Type: application/json"
```

**Expected Response** (HTTP 200):
```json
{
  "success": true,
  "agentStatus": "healthy",
  "device": {
    "isConnected": true,
    "deviceId": "ZKTeco_001"
  },
  "message": "Agent is healthy and device is connected",
  "timestamp": "2025-11-12T11:30:45.123Z"
}
```

**Verification**:
- [ ] HTTP status code is 200
- [ ] `success` equals `true`
- [ ] `agentStatus` equals "healthy"
- [ ] `device.isConnected` equals `true`
- [ ] Response includes descriptive message
- [ ] Timestamp is valid ISO 8601 format

**Backend Logs Expected**:
```
[11:30:45] [INFO] GET /biometric/agent-health
[11:30:45] [DEBUG] Agent health check request received
[11:30:45] [DEBUG] Calling agent: GET http://127.0.0.1:8765/health
[11:30:45] [DEBUG] Agent responded: status=healthy
[11:30:45] [INFO] Agent health check successful
```

---

### Test 2.2: Agent Offline

**Steps**:
1. Stop fingerprint agent: `taskkill /PID [agent-pid] /F`
2. Send health check request

**Expected Response** (HTTP 503):
```json
{
  "success": false,
  "agentStatus": "offline",
  "error": {
    "code": "AGENT_UNAVAILABLE",
    "message": "Fingerprint agent is not responding. Please ensure the agent is running on port 8765."
  },
  "timestamp": "2025-11-12T11:32:10.456Z"
}
```

**Verification**:
- [ ] HTTP status code is 503 (Service Unavailable)
- [ ] `success` equals `false`
- [ ] `agentStatus` equals "offline"
- [ ] Error message is clear and actionable
- [ ] Includes troubleshooting steps

**Recovery Test**:
1. Restart agent: `npm start` (from agent directory)
2. Retry health check
3. Should return success

---

### Test 2.3: Agent Timeout

**Steps**:
1. Configure short timeout in `.env`: `AGENT_TIMEOUT=100`
2. Send health check request during agent slowness

**Expected Behavior**:
```json
{
  "success": false,
  "agentStatus": "timeout",
  "error": {
    "code": "AGENT_TIMEOUT",
    "message": "Agent request timed out after 100ms"
  }
}
```

**Verification**:
- [ ] HTTP status is 408 or 503
- [ ] Clear timeout error message
- [ ] Service doesn't crash
- [ ] Subsequent requests work after recovery

---

## Capture Fingerprint Endpoint

**Endpoint**: `POST /biometric/capture-fingerprint`

**Objective**: Test fingerprint capture request to agent and response handling

### Test 3.1: Successful Capture

**DTO Request** (from frontend):
```json
{
  "qualityThreshold": 80,
  "maxRetries": 3,
  "timeout": 15000
}
```

**Request**:
```bash
curl -X POST http://localhost:3000/biometric/capture-fingerprint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [token]" \
  -d '{
    "qualityThreshold": 80,
    "maxRetries": 3,
    "timeout": 15000
  }'
```

**Expected Response** (HTTP 200):
```json
{
  "success": true,
  "image": "iVBORw0KGgoAAAANSUhEUgAAAUAAAAeACAIAAABTrhlBAAAA...",
  "template": "AQIDBA==",
  "quality": 85,
  "width": 320,
  "height": 480,
  "format": "image/png",
  "dataUri": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAUAAAAeACAIAAABTrhlBAAAA...",
  "timestamp": "2025-11-14T11:35:22.789Z",
  "requestId": "cap-1731410122789-f4a8c2e1"
}
```

**Verification Checklist**:
- [ ] HTTP status code is 200
- [ ] `success` equals `true`
- [ ] `image` is valid base64 string (directly accessible, not under `data`)
- [ ] `template` is valid base64 string
- [ ] `quality` >= qualityThreshold (80)
- [ ] Image dimensions: 320x480
- [ ] `dataUri` has correct format prefix
- [ ] `requestId` format: `cap-[timestamp]-[random]`
- [ ] `timestamp` is recent ISO 8601 timestamp
- [ ] Response is FLAT (no nested `data` wrapper)

**Database Check** (Optional):
```bash
# Verify no data stored yet (just capture, not save)
# Query should show empty biometric records for this user
```

**Backend Logs Expected**:
```
[11:35:22] [INFO] POST /biometric/capture-fingerprint
[11:35:22] [DEBUG] CaptureFingerprintDto validated: qualityThreshold=80
[11:35:22] [DEBUG] Forwarding capture request to agent
[11:35:22] [DEBUG] Agent capture response: qualityScore=85
[11:35:22] [INFO] Fingerprint captured successfully (quality: 85)
```

---

### Test 3.2: Quality Threshold Validation

**Steps**:
1. Capture fingerprint with low quality
2. Verify response indicates quality issue

**Request** (capture with dirty/light finger):
```bash
curl -X POST http://localhost:3000/biometric/capture-fingerprint \
  -H "Content-Type: application/json" \
  -d '{
    "qualityThreshold": 80,
    "maxRetries": 3
  }'
```

**Expected Response** (HTTP 200):
```json
{
  "success": true,
  "data": {
    "qualityScore": 55,
    "message": "Quality score (55) is below threshold (80). Consider retaking the fingerprint."
  }
}
```

**Verification**:
- [ ] Capture still succeeds
- [ ] Quality score returned
- [ ] Message advises user to retake
- [ ] Frontend can decide to accept or retake

---

### Test 3.3: Agent Offline During Capture

**Steps**:
1. Stop fingerprint agent
2. Send capture request

**Expected Response** (HTTP 503):
```json
{
  "success": false,
  "error": "Fingerprint agent is offline. Please ensure the local fingerprint scanning service is running.",
  "requestId": "cap-1731410156234-g7b9d5f2"
}
```

**Verification**:
- [ ] HTTP status is 503
- [ ] Error is flat string (not nested {code, message})
- [ ] Clear error message
- [ ] User-friendly troubleshooting hint
- [ ] `requestId` present for tracking

---

### Test 3.4: Capture Timeout

**Steps**:
1. Set very short timeout: `AGENT_TIMEOUT=1000`
2. Send capture request
3. Verify timeout handling

**Expected Response** (HTTP 408):
```json
{
  "success": false,
  "error": "Fingerprint capture timed out after 1000ms. Please try again.",
  "requestId": "cap-1731410156234-g7b9d5f2"
}
```

**Verification**:
- [ ] HTTP status is 408 (Request Timeout)
- [ ] Error is flat string
- [ ] Clear timeout error message
- [ ] Backend doesn't crash
- [ ] Service recovers for next request

**Restore timeout**:
```bash
# Reset to normal: AGENT_TIMEOUT=15000
```

---

### Test 3.5: Device Disconnected

**Steps**:
1. Send capture request
2. When "place finger" message appears (check agent logs), unplug scanner
3. Wait for response

**Expected Response** (HTTP 500):
```json
{
  "success": false,
  "error": "The fingerprint scanning device was disconnected. Please reconnect and try again.",
  "requestId": "cap-1731410156234-g7b9d5f2"
}
```

**Verification**:
- [ ] HTTP status is 500 (or appropriate error)
- [ ] Error is flat string
- [ ] Error message is user-friendly
- [ ] Service handles gracefully (no crash)

---

### Test 3.6: Retry Logic

**Objective**: Verify backend correctly implements retry logic

**Steps**:
1. Intentionally cause 2 failures (e.g., device issues)
2. On 3rd attempt, place finger correctly
3. Verify success

**Request**:
```bash
curl -X POST http://localhost:3000/biometric/capture-fingerprint \
  -H "Content-Type: application/json" \
  -d '{
    "qualityThreshold": 80,
    "maxRetries": 3
  }'
```

**Expected Backend Logs**:
```
[11:40:00] [DEBUG] Attempt 1/3: Device not ready
[11:40:05] [DEBUG] Retrying capture (attempt 2/3)
[11:40:10] [DEBUG] Attempt 2/3: Device error
[11:40:15] [DEBUG] Retrying capture (attempt 3/3)
[11:40:20] [DEBUG] Attempt 3/3: Success, quality=87
[11:40:20] [INFO] Fingerprint captured successfully
```

**Verification**:
- [ ] Backend logs show retry attempts
- [ ] Final success response received
- [ ] No excessive retries (stopped at maxRetries)
- [ ] Exponential backoff between retries (if implemented)

---

## Save Fingerprint Endpoint

**Endpoint**: `POST /biometric/save-fingerprint`

**Objective**: Test fingerprint storage to S3 and database

### Test 4.1: Successful Save with Base64 Image

**DTO Request**:
```json
{
  "userId": "user-123",
  "fingerprint": {
    "image": "iVBORw0KGgoAAAANSUhEUgAAAUAAAAeACAIAAABTrhlBAAAA...",
    "template": "AQIDBA==",
    "qualityScore": 85,
    "dataUri": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAUAAAAeACAIAAABTrhlBAAAA...",
    "format": "image/png"
  },
  "guardId": "guard-456"
}
```

**Request**:
```bash
curl -X POST http://localhost:3000/biometric/save-fingerprint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [token]" \
  -d @save-request.json
```

**Expected Response** (HTTP 201):
```json
{
  "success": true,
  "data": {
    "id": "fp-uuid-12345",
    "userId": "user-123",
    "guardId": "guard-456",
    "s3Key": "biometrics/user-123/fingerprint-2025-11-12.png",
    "imageUrl": "https://bucket.s3.amazonaws.com/biometrics/user-123/fingerprint-2025-11-12.png",
    "qualityScore": 85,
    "savedAt": "2025-11-12T11:42:15.123Z"
  },
  "message": "Fingerprint saved successfully",
  "requestId": "save-1731410535123-h8c2e9f3"
}
```

**Verification Checklist**:
- [ ] HTTP status code is 201 (Created)
- [ ] `success` equals `true`
- [ ] `data.id` is unique UUID
- [ ] `data.userId` matches request
- [ ] `data.guardId` matches request
- [ ] `data.s3Key` includes user ID and timestamp
- [ ] `data.imageUrl` is publicly accessible (if configured)
- [ ] `data.qualityScore` matches input
- [ ] `data.savedAt` is recent timestamp

**Database Verification**:
```bash
# Connect to database and verify record
npx prisma studio

# Query: SELECT * FROM Biometric WHERE userId = 'user-123'
# Expected: 1 record with matching data
```

**S3 Verification**:
```bash
# List S3 objects
aws s3 ls s3://[bucket]/biometrics/user-123/

# Expected output:
# 2025-11-12 11:42:15 125432 fingerprint-2025-11-12.png
```

**Backend Logs Expected**:
```
[11:42:15] [INFO] POST /biometric/save-fingerprint
[11:42:15] [DEBUG] SaveFingerprintDto validated
[11:42:15] [DEBUG] Uploading fingerprint to S3...
[11:42:16] [DEBUG] S3 upload successful: fingerprint-2025-11-12.png
[11:42:16] [DEBUG] Creating database record...
[11:42:16] [DEBUG] Database record created: fp-uuid-12345
[11:42:16] [INFO] Fingerprint saved successfully
```

---

### Test 4.2: Missing Required Fields

**Request** (missing `qualityScore`):
```bash
curl -X POST http://localhost:3000/biometric/save-fingerprint \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "fingerprint": {
      "image": "iVBORw0KGgoAAAA...",
      "template": "AQIDBA==",
      "dataUri": "data:image/png;base64,..."
    }
  }'
```

**Expected Response** (HTTP 400):
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "qualityScore",
        "message": "qualityScore must be a number"
      }
    ]
  }
}
```

**Verification**:
- [ ] HTTP status is 400 (Bad Request)
- [ ] Error code is "VALIDATION_ERROR"
- [ ] Specific field identified
- [ ] Clear error message

---

### Test 4.3: Invalid Quality Score Range

**Request** (quality > 100):
```bash
curl -X POST http://localhost:3000/biometric/save-fingerprint \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "fingerprint": {
      "image": "iVBORw0KGgoAAAA...",
      "qualityScore": 150
    }
  }'
```

**Expected Response** (HTTP 400):
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "qualityScore",
        "message": "qualityScore must not be greater than 100"
      }
    ]
  }
}
```

**Verification**:
- [ ] HTTP status is 400
- [ ] Range validation enforced (0-100)
- [ ] Clear error on invalid range

---

### Test 4.4: Invalid Image Format

**Request** (not base64):
```bash
curl -X POST http://localhost:3000/biometric/save-fingerprint \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "fingerprint": {
      "image": "NOT_VALID_BASE64!!!",
      "qualityScore": 85
    }
  }'
```

**Expected Response** (HTTP 400):
```json
{
  "success": false,
  "error": {
    "code": "INVALID_IMAGE_FORMAT",
    "message": "Image must be a valid base64-encoded PNG or BMP file"
  }
}
```

**Verification**:
- [ ] HTTP status is 400
- [ ] Format validation enforced
- [ ] Clear error message

---

### Test 4.5: S3 Upload Failure

**Objective**: Verify graceful error handling when S3 fails

**Setup**:
1. Make S3 credentials temporarily invalid in `.env`
2. Send save request

**Expected Response** (HTTP 500):
```json
{
  "success": false,
  "error": {
    "code": "S3_UPLOAD_FAILED",
    "message": "Failed to upload fingerprint to storage. Please try again."
  }
}
```

**Verification**:
- [ ] HTTP status is 500
- [ ] Clear error message
- [ ] Database record NOT created (transaction rollback)
- [ ] No orphaned S3 objects

**Restore credentials**:
```bash
# Restore correct AWS credentials in .env
```

**Database Check**:
```bash
# Verify no record created on S3 failure
npx prisma studio
# SELECT COUNT(*) FROM Biometric WHERE userId='user-123'
# Should be 0 (or previous count)
```

---

## DTO Validation Testing

**Objective**: Comprehensive validation of DTOs and decorators

### Test 5.1: CaptureFingerprintDto Validation

**Valid DTO**:
```json
{
  "qualityThreshold": 80,
  "maxRetries": 3,
  "timeout": 15000
}
```

**Invalid Cases**:

| Field | Invalid Value | Expected Error |
|-------|----------------|-----------------|
| `qualityThreshold` | -10 | "must not be less than 0" |
| `qualityThreshold` | 150 | "must not be greater than 100" |
| `maxRetries` | 0 | "must not be less than 1" |
| `maxRetries` | 20 | "must not be greater than 10" |
| `timeout` | 500 | "must not be less than 1000" |
| `timeout` | 60000 | "must not be greater than 30000" |

**Test Each Case**:
```bash
curl -X POST http://localhost:3000/biometric/capture-fingerprint \
  -H "Content-Type: application/json" \
  -d '{
    "qualityThreshold": -10,
    "maxRetries": 3,
    "timeout": 15000
  }'
# Expected: 400 error with "must not be less than 0"
```

**Verification**:
- [ ] All invalid values rejected with 400
- [ ] Error messages match decorators
- [ ] Valid values accepted with 200
- [ ] Type coercion works (string "80" → number 80)

---

### Test 5.2: SaveFingerprintDto Validation

**Valid DTO**:
```json
{
  "userId": "user-123",
  "guardId": "guard-456",
  "fingerprint": {
    "image": "iVBORw0KGg...",
    "template": "AQIDBA==",
    "qualityScore": 85,
    "dataUri": "data:image/png;base64,iVBORw0...",
    "format": "image/png"
  }
}
```

**Invalid Cases**:

| Field | Invalid Value | Expected Error |
|----------|---------------|-----------------|
| `userId` | "" | "should not be empty" |
| `userId` | null | "should not be empty" |
| `qualityScore` | -5 | "must not be less than 0" |
| `qualityScore` | 105 | "must not be greater than 100" |
| `image` | "" | "invalid base64 format" |
| `dataUri` | "not-data-uri" | "must start with data:image" |

**Test Each Case**:
```bash
# Test empty userId
curl -X POST http://localhost:3000/biometric/save-fingerprint \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "",
    "fingerprint": {...}
  }'
# Expected: 400 with "should not be empty"
```

---

## FileService Integration

**Objective**: Verify S3 upload integration

### Test 6.1: FileService S3 Upload

**Setup**:
1. Verify AWS credentials in `.env`
2. Verify S3 bucket is writable

**Test**:
```bash
# Create test file
echo "test fingerprint data" > test-fp.txt

# Upload via biometric API
curl -X POST http://localhost:3000/biometric/save-fingerprint \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "fingerprint": {
      "image": "iVBORw0KGg...",
      "qualityScore": 90
    }
  }'
```

**Expected Behavior**:
- [ ] S3 upload succeeds
- [ ] File has correct key format
- [ ] File is accessible via returned URL
- [ ] File has correct permissions

**Verify in S3**:
```bash
# Check file exists
aws s3 ls s3://[bucket]/biometrics/test-user/

# Check file is readable
curl "https://[bucket].s3.amazonaws.com/biometrics/test-user/fingerprint-2025-11-12.png"
# Expected: Binary PNG data
```

---

### Test 6.2: Key Generation Format

**Objective**: Verify S3 keys follow naming convention

**Steps**:
1. Save multiple fingerprints for same user
2. Verify key format consistency

**Expected Key Format**:
```
biometrics/{userId}/fingerprint-{YYYY-MM-DD}.png
biometrics/user-123/fingerprint-2025-11-12.png
biometrics/user-123/fingerprint-2025-11-13.png (if on different day)
```

**Verification**:
```bash
aws s3 ls s3://[bucket]/biometrics/user-123/ --recursive

# Expected output:
# 2025-11-12 11:42:15      125432 fingerprint-2025-11-12.png
# 2025-11-13 09:15:20      128745 fingerprint-2025-11-13.png
```

- [ ] Keys include user ID
- [ ] Keys include date
- [ ] Date format is consistent (YYYY-MM-DD)
- [ ] File extension is correct (.png)

---

## Error Handling & Logging

### Test 7.1: Error Response Format

**Objective**: Verify all errors follow consistent format

**Expected Format**:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_IN_CAPS",
    "message": "User-friendly message"
  },
  "requestId": "req-[timestamp]-[random]",
  "timestamp": "2025-11-12T11:45:00.123Z"
}
```

**Test Different Error Types**:

```bash
# 400 Bad Request
curl http://localhost:3000/biometric/capture-fingerprint \
  -H "Content-Type: application/json" \
  -d '{"qualityThreshold": "invalid"}'

# 401 Unauthorized (if auth required)
curl http://localhost:3000/biometric/agent-health

# 404 Not Found
curl http://localhost:3000/biometric/nonexistent

# 503 Service Unavailable (agent down)
# [Stop agent first]
curl http://localhost:3000/biometric/agent-health
```

**Verification**:
- [ ] All errors include `success: false`
- [ ] All errors have `error.code` in CAPS_WITH_UNDERSCORES
- [ ] All errors have clear `error.message`
- [ ] All errors include `requestId`
- [ ] All errors include `timestamp`

---

### Test 7.2: Request Logging

**Objective**: Verify all requests logged with details

**Steps**:
1. Send various requests
2. Check logs for complete information

**Expected Log Format**:
```
[11:45:30] [INFO] POST /biometric/capture-fingerprint [requestId: cap-1731410730123-a9d3f4e2]
[11:45:30] [DEBUG] User: user-123 | IP: 127.0.0.1
[11:45:30] [DEBUG] Request body: {"qualityThreshold": 80, "maxRetries": 3}
[11:45:30] [DEBUG] DTO validation passed
[11:45:35] [DEBUG] Agent response received (quality: 85)
[11:45:35] [INFO] Request completed: 200 OK (5123ms)
```

**Verification**:
- [ ] Each request logged with timestamp
- [ ] RequestId included in all related logs
- [ ] Method and endpoint logged
- [ ] Response time logged
- [ ] HTTP status logged

---

### Test 7.3: Error Logging with Stack Trace

**Objective**: Verify errors logged with stack trace

**Steps**:
1. Trigger an error condition
2. Check error logs

**Expected Error Log**:
```
[11:46:00] [ERROR] S3 upload failed: EACCES: Permission denied
[11:46:00] [ERROR] Stack trace:
    at Object.uploadToS3 (src/services/file.service.ts:145:15)
    at BiometricService.saveFingerprintData (src/biometric/biometric.service.ts:87:24)
[11:46:00] [ERROR] Request failed: save-1731410760234-c5e7f2g9
```

**Verification**:
- [ ] Error messages logged to error.log
- [ ] Stack traces included
- [ ] File paths and line numbers visible
- [ ] RequestId included for tracking

---

## Swagger Documentation

**Endpoint**: `http://localhost:3000/api/docs`

**Objective**: Verify Swagger/OpenAPI documentation

### Test 8.1: Swagger UI Accessibility

**Steps**:
1. Open browser: `http://localhost:3000/api/docs`
2. Verify page loads

**Expected**:
- [ ] Swagger UI loads without errors
- [ ] All endpoints listed under "Biometric"
- [ ] No 404 errors in console

---

### Test 8.2: Endpoint Documentation

**Verify Each Endpoint**:

**GET /biometric/agent-health**
- [ ] Method shown as GET
- [ ] Description present
- [ ] Response schemas documented
- [ ] 200, 503 responses shown

**POST /biometric/capture-fingerprint**
- [ ] Method shown as POST
- [ ] Request body schema shown
- [ ] All DTO fields documented
- [ ] Response schemas for 200, 400, 408, 503 shown
- [ ] Field validation rules visible

**POST /biometric/save-fingerprint**
- [ ] Method shown as POST
- [ ] Request body schema shown
- [ ] Fingerprint object documented
- [ ] Response schemas shown
- [ ] All error cases documented

---

### Test 8.3: Try It Out

**Steps**:
1. In Swagger UI, click "Try it out" on /biometric/agent-health
2. Click "Execute"

**Expected**:
- [ ] Request is sent
- [ ] Response received and displayed
- [ ] Response code shown (200, 503, etc.)
- [ ] Response body formatted as JSON

---

## Concurrent Request Handling

### Test 9.1: Multiple Concurrent Captures

**Objective**: Verify service handles simultaneous capture requests

**Setup**:
```bash
#!/bin/bash
# concurrent-captures.sh

for i in {1..5}; do
  echo "Starting capture $i..."
  curl -X POST http://localhost:3000/biometric/capture-fingerprint \
    -H "Content-Type: application/json" \
    -d '{
      "qualityThreshold": 80,
      "maxRetries": 3,
      "timeout": 15000
    }' \
    -w "\nHTTP Status: %{http_code}\nTime: %{time_total}s\n" &
done

wait
```

**Run Test**:
```bash
bash concurrent-captures.sh
```

**Expected Behavior**:
- [ ] All 5 requests initiated
- [ ] Agent queues/serializes captures
- [ ] No requests fail with 500 errors
- [ ] Response times reasonable (no stalls)
- [ ] All responses returned eventually

**Expected Response Times**:
- Request 1: ~10s (capture time)
- Request 2: ~20s (queued)
- Request 3: ~30s (queued)
- Request 4: ~40s (queued)
- Request 5: ~50s (queued)

---

### Test 9.2: Capture During Save

**Objective**: Verify service handles capture while save in progress

**Steps**:
1. Send save request with large file (slow upload)
2. Immediately send capture request
3. Verify both complete successfully

**Expected Behavior**:
- [ ] Save continues uploading to S3
- [ ] Capture request queued (or returns 429)
- [ ] Both complete without errors
- [ ] Database consistency maintained

---

## Performance & Load Testing

### Test 10.1: Response Time SLAs

**Objective**: Verify endpoints meet response time requirements

**Measurements**:

```bash
# Test agent-health response time
ab -n 100 -c 10 http://localhost:3000/biometric/agent-health

# Test capture-fingerprint (simulated with mock data)
# [Requires mock agent endpoint]
```

**Expected SLAs**:
- [ ] Agent health check: < 500ms
- [ ] Capture response: < 20s (includes user interaction)
- [ ] Save response: < 30s (includes S3 upload)

---

### Test 10.2: Sustained Load

**Objective**: Verify service stability over time

**Test**:
```bash
# 1 request every 5 seconds for 30 minutes
for i in {1..360}; do
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$timestamp] Request $i..."
  
  curl -X GET http://localhost:3000/biometric/agent-health \
    -w "Status: %{http_code}, Time: %{time_total}s\n"
  
  sleep 5
done
```

**Expected Results**:
- [ ] No 5xx errors during test
- [ ] Response times stable (no degradation)
- [ ] All 360 requests complete
- [ ] Service remains responsive

---

### Test 10.3: Memory Stability

**Objective**: Verify no memory leaks over time

**Procedure**:
```bash
# Monitor memory while running load test
watch -n 10 'curl http://localhost:3000/health 2>/dev/null | jq ".process.memory"'

# Run concurrent captures
for i in {1..50}; do
  curl -X POST http://localhost:3000/biometric/capture-fingerprint \
    -H "Content-Type: application/json" \
    -d '{"qualityThreshold": 80}' &
done
```

**Expected**:
- [ ] Initial memory: ~100-150 MB
- [ ] Peak during load: ~200-300 MB
- [ ] After load: Returns to ~100-150 MB (no leak)

---

## Regression Testing

### Test 11.1: Existing Networked Device Endpoints

**Objective**: Verify biometric implementation doesn't break existing endpoints

**Check These Endpoints**:

**GET /device** (list devices)
```bash
curl http://localhost:3000/device
# Expected: 200, device list unchanged
```

**GET /device/{id}** (get specific device)
```bash
curl http://localhost:3000/device/device-1
# Expected: 200, device details unchanged
```

**POST /device** (create device - if applicable)
```bash
curl -X POST http://localhost:3000/device \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Device"}'
# Expected: Device created successfully
```

**PUT /device/{id}** (update device)
```bash
curl -X PUT http://localhost:3000/device/device-1 \
  -H "Content-Type: application/json" \
  -d '{"status": "active"}'
# Expected: Device updated successfully
```

**DELETE /device/{id}** (delete device)
```bash
curl -X DELETE http://localhost:3000/device/device-1
# Expected: Device deleted successfully
```

**Verification**:
- [ ] All endpoints return expected status codes
- [ ] Response formats unchanged
- [ ] Data integrity maintained
- [ ] No new errors introduced

---

### Test 11.2: User/Guard Endpoints Not Affected

**Test Key Endpoints**:

**GET /user/{id}**
```bash
curl http://localhost:3000/user/user-123
# Expected: 200, user details correct
```

**GET /guard/{id}**
```bash
curl http://localhost:3000/guard/guard-456
# Expected: 200, guard details correct
```

**POST /guard** (create guard)
```bash
curl -X POST http://localhost:3000/guard \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "serviceNumber": "G001"}'
# Expected: 201, guard created
```

**Verification**:
- [ ] All endpoints return correct status codes
- [ ] Data unchanged from before biometric implementation
- [ ] No side effects from biometric module

---

## Complete Test Execution

### Automated Test Script

```bash
#!/bin/bash
# test-biometric-api.sh

echo "=== Biometric API Test Suite ==="

# 1. Health Check
echo "1. Testing Agent Health..."
curl -X GET http://localhost:3000/biometric/agent-health | jq '.'

# 2. Capture Test
echo "2. Testing Capture Fingerprint..."
read -p "Press Enter when ready to scan..."
curl -X POST http://localhost:3000/biometric/capture-fingerprint \
  -H "Content-Type: application/json" \
  -d '{"qualityThreshold": 80}' | jq '.'

# 3. Save Test
echo "3. Testing Save Fingerprint..."
curl -X POST http://localhost:3000/biometric/save-fingerprint \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user", "fingerprint": {...}}' | jq '.'

echo "=== Tests Complete ==="
```

---

## Sign-Off

**Test Execution Date**: ___________________

**Tested By**: ___________________

**Backend Version**: ___________________

**Agent Version**: ___________________

**Results Summary**:
- [ ] All health check tests passed
- [ ] All capture endpoint tests passed
- [ ] All save endpoint tests passed
- [ ] All validation tests passed
- [ ] All error handling tests passed
- [ ] All concurrent request tests passed
- [ ] All performance tests passed
- [ ] All regression tests passed

**Issues Found**: 
```
[List any defects or issues]
```

**Approved for Release**: [ ] Yes [ ] No

**Approval Authority**: ___________________

**Date**: ___________________

---

**Document Version**: 1.0
**Last Updated**: November 12, 2025

