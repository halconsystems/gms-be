# Quick Reference: Fingerprint Capture Testing

**Last Updated:** November 12, 2025

---

## Phase 1: Restart & Verify

### 1. Restart Backend
```bash
cd gms-be
npm run start:dev
```

**Expected:**
```
Nest application successfully started on port 5001
```

---

## Phase 2: Quick Curl Tests

### Test 1: String Numbers (CRITICAL - Most Important)
```bash
curl -X POST http://localhost:5001/biometric/capture-fingerprint \
  -H "Content-Type: application/json" \
  -d '{"deviceIndex":"0","maxRetries":"3","timeout":"15000"}'
```

**Expected:**
- HTTP 200 (or 504 timeout if no device - acceptable)
- NO "Expected 2 arguments, got 1" error
- Backend logs: `DTO Values: deviceIndex: 0 (type: number)`

**If Failure:** ❌ Transformation not working - check global ValidationPipe

---

### Test 2: Native Numbers (Validation)
```bash
curl -X POST http://localhost:5001/biometric/capture-fingerprint \
  -H "Content-Type: application/json" \
  -d '{"deviceIndex":0,"maxRetries":3,"timeout":15000}'
```

**Expected:** Same as Test 1

---

### Test 3: Invalid Type (Edge Case)
```bash
curl -X POST http://localhost:5001/biometric/capture-fingerprint \
  -H "Content-Type: application/json" \
  -d '{"deviceIndex":"abc"}'
```

**Expected:** HTTP 400 - Cannot transform "abc" to number

---

### Test 4: Out-of-Range (Validation)
```bash
curl -X POST http://localhost:5001/biometric/capture-fingerprint \
  -H "Content-Type: application/json" \
  -d '{"deviceIndex":"999"}'
```

**Expected:** HTTP 400 - Value exceeds max of 10

---

### Test 5: Empty Body (Uses Defaults)
```bash
curl -X POST http://localhost:5001/biometric/capture-fingerprint \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected:** HTTP 200 (or 504) - Defaults applied

---

## Phase 3: What to Check in Backend Logs

### ✅ Signs of Success
```
[11:35:22] [INFO] POST /biometric/capture-fingerprint
[11:35:22] [DEBUG] DTO Values: 
  deviceIndex: 0 (type: number)    ← Should be NUMBER not STRING
  maxRetries: 3 (type: number)     ← Should be NUMBER not STRING
  timeout: 15000 (type: number)    ← Should be NUMBER not STRING
[11:35:22] [DEBUG] Calling agent: POST http://127.0.0.1:8765/fingerprint/capture
```

### ❌ Signs of Failure
```
[11:35:22] [DEBUG] DTO Values:
  deviceIndex: "0" (type: string)   ← WRONG: Still a string!
  maxRetries: "3" (type: string)    ← WRONG: Still a string!
  timeout: "15000" (type: string)   ← WRONG: Still a string!

[Agent] Error: Expected 2 arguments, got 1
```

---

## Phase 4: Frontend Integration Test

1. **Navigate to:** Employees → Select Employee → Biometric Tab
2. **Click:** "Check Agent" button
3. **Verify:** Shows connected/healthy status
4. **Click:** "Scan Fingerprint" button
5. **Check:** No "Expected 2 arguments" error
6. **Verify:** Fingerprint scan modal appears and works

---

## Quick Troubleshooting

| Issue | Check |
|-------|-------|
| "Expected 2 arguments, got 1" | Backend logs - are DTO values strings or numbers? |
| 400 validation error on valid input | Verify @Type decorators in DTO |
| Numeric values rejected | Check @Min/@Max ranges in DTO |
| "abc" converted to 0 | This is OK if transformation is working |
| Backend doesn't restart | Check for TypeScript compilation errors |

---

## Critical Files

**Transformation happens in this order:**

1. **main.ts** - Global ValidationPipe must have `transform: true`
2. **capture-fingerprint.dto.ts** - @Type decorators must be first
3. **biometric.controller.ts** - Accepts @Body() dto: CaptureFingerprintDto
4. **biometric.service.ts** - Defensive normalization (backup layer)
5. **fingerprint.js (agent)** - Final conversion before hardware

---

## Expected Results Matrix

| Input | Type | Expected Output | Status |
|-------|------|-----------------|--------|
| `"0"` | string | `0` (number) | ✅ Transform |
| `0` | number | `0` (number) | ✅ Pass-through |
| `"abc"` | string | 400 error | ✅ Reject |
| `999` | number | 400 error | ✅ Validate |
| Missing | undefined | Default used | ✅ Default |

---

## Success = All Tests Pass

- ✅ String numbers transformed correctly
- ✅ Backend logs show numeric types
- ✅ Agent accepts requests
- ✅ No "Expected 2 arguments" errors
- ✅ Frontend captures fingerprint successfully

---

## One-Liner to Check All Tests

```bash
echo "=== Test 1: String Numbers ===" && \
curl -s -X POST http://localhost:5001/biometric/capture-fingerprint \
  -H "Content-Type: application/json" \
  -d '{"deviceIndex":"0","maxRetries":"3","timeout":"15000"}' | jq '.success' && \
echo "=== Test 2: Invalid Type ===" && \
curl -s -X POST http://localhost:5001/biometric/capture-fingerprint \
  -H "Content-Type: application/json" \
  -d '{"deviceIndex":"abc"}' | jq '.error' && \
echo "=== Test 3: Out of Range ===" && \
curl -s -X POST http://localhost:5001/biometric/capture-fingerprint \
  -H "Content-Type: application/json" \
  -d '{"deviceIndex":"999"}' | jq '.error' && \
echo "=== All tests executed ==="
```

---

**Documentation:** See `BIOMETRIC_API_TESTING.md` Section 0 for detailed transformation pipeline explanation.

**Summary:** See `REVERT_COMPLETION_SUMMARY.md` for complete revert details.
