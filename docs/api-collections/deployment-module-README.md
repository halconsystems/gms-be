# Guard Deployment & Assignment API Documentation

## Overview

The Guard Deployment & Assignment API provides comprehensive endpoints for managing guard and supervisor assignments across security locations. This API handles the complete lifecycle of deployment operations including:

- **Guard Assignment**: Deploy guards to locations with category and shift tracking
- **Supervisor Assignment**: Establish supervisory relationships between employees
- **Location Deployment**: Monitor deployment status and requirements at specific locations

All endpoints follow REST conventions, require JWT bearer token authentication, and return responses wrapped in a standardized format with status, message, and data fields.

---

## Quick Start

### Prerequisites

- Valid JWT bearer token (obtain via `/auth/login`)
- Organization access through `organizationAdmin` or `manager` role
- Postman or REST client for API testing

### Getting Started in Postman

1. **Import Collection**:
   - Open Postman
   - Click **Import** → **File** → Select `deployment-module-postman.json`
   - Collection will load with all 11 endpoints organized by functional area

2. **Configure Environment**:
   - Create new Environment: **Settings** → **Environments** → **Create**
   - Add variables:
     - `baseUrl`: `http://localhost:5001` (development) or `https://portal.guardsos.com` (production)
     - `bearerToken`: Leave empty initially
     - `organizationId`: Your organization UUID

3. **Authenticate**:
   - Run **Auth** folder → **Login** endpoint
   - Enter your credentials in request body
   - Test script automatically saves `bearerToken` to environment
   - All subsequent requests now use this token

4. **Execute Endpoints**:
   - Navigate to desired folder (Guard Assignment, Supervisor Assignment, Location Deployment)
   - Select endpoint and run
   - View response in **Body** tab

---

## Authentication

### JWT Bearer Token

All endpoints require Bearer token authentication via HTTP Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Obtaining Token

**Endpoint**: `POST /auth/login`

**Request**:
```json
{
  "email": "admin@guardsos.com",
  "password": "secure-password"
}
```

**Response**:
```json
{
  "status": "success",
  "message": "Login successful",
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "admin@guardsos.com",
      "fullName": "Admin User",
      "roles": ["organizationAdmin"]
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Token Usage**:
```javascript
// Manual header setup
fetch('http://localhost:5001/guards/assign-guard', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({...})
})
```

---

## Response Format

All API responses follow a standardized format wrapping data in a `TransformInterceptor`:

### Success Response
```json
{
  "status": "success",
  "message": "Guard successfully assigned to location",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "guardId": "550e8400-e29b-41d4-a716-446655440002",
    "locationId": "550e8400-e29b-41d4-a716-446655440003",
    "deploymentDate": "2025-11-13",
    "totalWorkingDays": 30
  }
}
```

### Error Response
```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": [
    {
      "field": "guardId",
      "message": "Guard not found"
    },
    {
      "field": "requestedGuardId",
      "message": "Requested guard slot already filled"
    }
  ]
}
```

### Response Properties

| Property | Type | Description |
|----------|------|-------------|
| `status` | string | Either `success` or `error` |
| `message` | string | Descriptive message about the operation |
| `data` | object | Response payload (varies by endpoint) |
| `errors` | array | Field-level validation errors (only on error) |

---

## HTTP Status Codes

| Code | Meaning | Common Causes |
|------|---------|--------------|
| `200` | OK | Successful GET or PATCH operation |
| `201` | Created | Successful POST operation (resource created) |
| `400` | Bad Request | Validation failure, missing required fields |
| `401` | Unauthorized | Missing or invalid JWT token |
| `403` | Forbidden | Insufficient permissions or business rule violation |
| `404` | Not Found | Requested resource doesn't exist |
| `422` | Unprocessable Entity | Request well-formed but contains semantic errors |

---

## Role-Based Access Control

Endpoints implement role-based access control through NestJS guards:

| Role | Permissions |
|------|------------|
| `organizationAdmin` | Full access to all endpoints |
| `manager` | Full access to assign/promote operations |
| `supervisor` | Read-only access to their supervised locations |
| `guardSupervisor` | Read-only access to their supervised guards |

**Access Pattern Example**:
```
POST /guards/assign-guard          → organizationAdmin, manager
GET /location/assigned-guard       → organizationAdmin, manager, supervisor (filtered)
POST /employee/assign-supervisor   → organizationAdmin, manager
```

---

## API Endpoints

### Guard Assignment Operations

#### 1. Assign Guard to Location

**Endpoint**: `POST /guards/assign-guard`

**Purpose**: Assigns a guard to a location's requested guard slot, creating an assignment record with deployment tracking.

**Authentication**: Bearer token (organizationAdmin, manager roles)

**Request Body**:
```json
{
  "requestedGuardId": "550e8400-e29b-41d4-a716-446655440010",
  "locationId": "550e8400-e29b-41d4-a716-446655440020",
  "guardCategoryId": "550e8400-e29b-41d4-a716-446655440030",
  "guardId": "550e8400-e29b-41d4-a716-446655440040",
  "serviceNumber": null
}
```

**Request Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requestedGuardId` | string (UUID) | Yes | UUID of the requested guard slot |
| `locationId` | string (UUID) | Yes | UUID of the location |
| `guardCategoryId` | string (UUID) | Yes | UUID of guard category (e.g., "Armed", "Unarmed") |
| `guardId` | string (UUID) | Conditional | UUID of guard (required if serviceNumber not provided) |
| `serviceNumber` | integer | Conditional | Service number of guard (required if guardId not provided) |

**Response** (201 Created):
```json
{
  "status": "success",
  "message": "Guard successfully assigned to location",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440050",
    "guardId": "550e8400-e29b-41d4-a716-446655440040",
    "locationId": "550e8400-e29b-41d4-a716-446655440020",
    "requestedGuardId": "550e8400-e29b-41d4-a716-446655440010",
    "deploymentDate": "2025-11-13",
    "deploymentTill": "2025-12-13",
    "guardCategoryId": "550e8400-e29b-41d4-a716-446655440030",
    "totalWorkingDays": 30,
    "clientName": "Acme Corporation",
    "clientContractNumber": "ACC-2025-001",
    "locationName": "Downtown Office"
  }
}
```

**Validation Rules**:
- `requestedGuardId` must exist and not already be filled
- `locationId` must exist and be active
- `guardCategoryId` must match requested category
- Guard must not exceed deployment quantity limit
- Guard cannot have overlapping deployments at same location

**Error Examples**:

Request with guard already deployed:
```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": [
    {
      "field": "guardId",
      "message": "Guard already deployed at this location"
    }
  ]
}
```

---

#### 2. Get Assigned Guard Details

**Endpoint**: `GET /guards/assigned-guard`

**Purpose**: Retrieves comprehensive assignment details with calculated working days and flattened client/location information.

**Authentication**: Bearer token (any role)

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `guardId` | string (UUID) | Conditional | UUID of guard (required if serviceNumber not provided) |
| `serviceNumber` | integer | Conditional | Service number of guard (required if guardId not provided) |

**Example Requests**:
```
GET /guards/assigned-guard?guardId=550e8400-e29b-41d4-a716-446655440040

GET /guards/assigned-guard?serviceNumber=12345
```

**Response** (200 OK):
```json
{
  "status": "success",
  "message": "Assignment details retrieved",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440050",
    "guardId": "550e8400-e29b-41d4-a716-446655440040",
    "locationId": "550e8400-e29b-41d4-a716-446655440020",
    "requestedGuardId": "550e8400-e29b-41d4-a716-446655440010",
    "deploymentDate": "2025-11-13",
    "deploymentTill": "2025-12-13",
    "guardCategoryId": "550e8400-e29b-41d4-a716-446655440030",
    "totalWorkingDays": 30,
    "clientName": "Acme Corporation",
    "clientContractNumber": "ACC-2025-001",
    "locationName": "Downtown Office"
  }
}
```

**Use Cases**:
- Retrieve current assignment for a guard
- Check deployment dates and location
- Calculate payroll periods
- Verify deployment validity

---

#### 3. Promote to Supervisor

**Endpoint**: `POST /guards/promote-to-supervisor?guardId={id}&personType=guard`

**Purpose**: Promotes a person to supervisor role by assigning 'supervisor' role to their user account and creating an AssignedSupervisor record for location management.

**Authentication**: Bearer token (organizationAdmin role)

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `guardId` | string (UUID) | Conditional | UUID of guard/employee (required if serviceNumber not provided) |
| `serviceNumber` | integer | Conditional | Service number (required if guardId not provided) |
| `personType` | string | Yes | Either `guard` or `employee` |

**Request Body**:
```json
{
  "locationId": "550e8400-e29b-41d4-a716-446655440020",
  "clientId": "550e8400-e29b-41d4-a716-446655440060",
  "deploymentTill": "2026-11-13"
}
```

**Request Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `locationId` | string (UUID) | Yes | Location where supervisor will operate |
| `clientId` | string (UUID) | Yes | Client organization |
| `deploymentTill` | string (ISO-8601) | No | Supervision end date |

**Response** (201 Created):
```json
{
  "status": "success",
  "message": "Employee promoted to supervisor role",
  "data": {
    "assignedSupervisor": {
      "id": "550e8400-e29b-41d4-a716-446655440070",
      "locationId": "550e8400-e29b-41d4-a716-446655440020",
      "employeeId": "550e8400-e29b-41d4-a716-446655440040",
      "supervisorEmployeeId": "550e8400-e29b-41d4-a716-446655440040",
      "clientId": "550e8400-e29b-41d4-a716-446655440060",
      "deploymentDate": "2025-11-13",
      "deploymentTill": "2026-11-13",
      "isActive": true,
      "totalWorkingDays": 365
    },
    "person": {
      "id": "550e8400-e29b-41d4-a716-446655440040",
      "fullName": "John Smith",
      "serviceNumber": 12345,
      "roles": ["supervisor"]
    }
  }
}
```

**Business Logic**:
1. Resolves guard to employee (if needed)
2. Adds 'supervisor' role to user account
3. Creates AssignedSupervisor record at location
4. Calculates initial deployment period

**Validation Rules**:
- Person must exist as guard or employee
- Location must exist and be active
- Client must be associated with location
- Person cannot already be supervisor at same location

---

### Supervisor Assignment Operations

#### 4. Assign Supervisor to Employee

**Endpoint**: `POST /employee/assign-supervisor`

**Purpose**: Creates a supervisory relationship between an employee and supervisor at a specific location.

**Authentication**: Bearer token (organizationAdmin, manager roles)

**Request Body**:
```json
{
  "employeeId": "550e8400-e29b-41d4-a716-446655440040",
  "serviceNumber": null,
  "supervisorEmployeeId": "550e8400-e29b-41d4-a716-446655440050",
  "supervisorServiceNumber": null,
  "locationId": "550e8400-e29b-41d4-a716-446655440020",
  "clientId": "550e8400-e29b-41d4-a716-446655440060",
  "deploymentTill": "2026-11-13"
}
```

**Request Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `employeeId` | string (UUID) | Conditional | UUID of employee (required if serviceNumber not provided) |
| `serviceNumber` | integer | Conditional | Service number of employee (required if employeeId not provided) |
| `supervisorEmployeeId` | string (UUID) | Conditional | UUID of supervisor (required if supervisorServiceNumber not provided) |
| `supervisorServiceNumber` | integer | Conditional | Service number of supervisor (required if supervisorEmployeeId not provided) |
| `locationId` | string (UUID) | Yes | Location where supervision occurs |
| `clientId` | string (UUID) | Yes | Client organization |
| `deploymentTill` | string (ISO-8601) | No | Supervision end date |

**Response** (201 Created):
```json
{
  "status": "success",
  "message": "Supervisor successfully assigned",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440070",
    "locationId": "550e8400-e29b-41d4-a716-446655440020",
    "employeeId": "550e8400-e29b-41d4-a716-446655440040",
    "clientId": "550e8400-e29b-41d4-a716-446655440060",
    "supervisorEmployeeId": "550e8400-e29b-41d4-a716-446655440050",
    "deploymentDate": "2025-11-13",
    "deploymentTill": "2026-11-13",
    "isActive": true,
    "totalWorkingDays": 365,
    "location": {
      "id": "550e8400-e29b-41d4-a716-446655440020",
      "locationName": "Downtown Office"
    },
    "client": {
      "id": "550e8400-e29b-41d4-a716-446655440060",
      "companyName": "Acme Corporation"
    },
    "employee": {
      "id": "550e8400-e29b-41d4-a716-446655440040",
      "fullName": "John Smith",
      "serviceNumber": 12345
    },
    "supervisor": {
      "id": "550e8400-e29b-41d4-a716-446655440050",
      "fullName": "Jane Manager",
      "serviceNumber": 12346
    }
  }
}
```

**Validation Rules**:
- Employee and supervisor must exist
- Both must be active in the system
- Supervisor must have supervisor role
- Location and client must exist
- Cannot create duplicate assignments

---

#### 5. Get Supervisors for Employee

**Endpoint**: `GET /employee/get-assigned-supervisors/{employeeId}`

**Purpose**: Returns all supervisors assigned to a specific employee with location and client details.

**Authentication**: Bearer token (any role)

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `employeeId` | string (UUID) | UUID of the employee |

**Example Request**:
```
GET /employee/get-assigned-supervisors/550e8400-e29b-41d4-a716-446655440040
```

**Response** (200 OK):
```json
{
  "status": "success",
  "message": "Supervisors retrieved",
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440070",
      "locationId": "550e8400-e29b-41d4-a716-446655440020",
      "employeeId": "550e8400-e29b-41d4-a716-446655440040",
      "supervisorEmployeeId": "550e8400-e29b-41d4-a716-446655440050",
      "clientId": "550e8400-e29b-41d4-a716-446655440060",
      "deploymentDate": "2025-11-13",
      "deploymentTill": "2026-11-13",
      "isActive": true,
      "totalWorkingDays": 365,
      "location": {
        "id": "550e8400-e29b-41d4-a716-446655440020",
        "locationName": "Downtown Office"
      },
      "client": {
        "id": "550e8400-e29b-41d4-a716-446655440060",
        "companyName": "Acme Corporation"
      },
      "supervisor": {
        "id": "550e8400-e29b-41d4-a716-446655440050",
        "fullName": "Jane Manager",
        "serviceNumber": 12346
      }
    }
  ]
}
```

---

#### 6. Lookup Supervisors by Service Number

**Endpoint**: `GET /employee/by-service-number/{serviceNumber}`

**Purpose**: Retrieves supervisor assignments using employee service number instead of UUID for convenience.

**Authentication**: Bearer token (any role)

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `serviceNumber` | integer | Service number of the employee |

**Example Request**:
```
GET /employee/by-service-number/12345
```

**Response** (200 OK):
```json
{
  "status": "success",
  "message": "Supervisors retrieved by service number",
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440070",
      "supervisor": {
        "fullName": "Jane Manager",
        "serviceNumber": 12346
      }
    }
  ]
}
```

---

#### 7. Flexible Supervisor Lookup

**Endpoint**: `GET /employee/supervisors/by-service-number/{serviceNumber}/any`

**Purpose**: Intelligent bidirectional lookup that handles both supervisors and supervisees using service number.

**Authentication**: Bearer token (any role)

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `serviceNumber` | integer | Service number of the person |

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `personType` | string | No | Either `guard` or `employee` (auto-resolved if omitted) |

**Example Requests**:
```
GET /employee/supervisors/by-service-number/12345/any

GET /employee/supervisors/by-service-number/12345/any?personType=guard
```

**Response** (200 OK - if person is supervisee):
```json
{
  "status": "success",
  "message": "Supervisors for employee",
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440070",
      "supervisor": {
        "fullName": "Jane Manager",
        "serviceNumber": 12346
      }
    }
  ]
}
```

**Response** (200 OK - if person is supervisor):
```json
{
  "status": "success",
  "message": "Supervised employees for supervisor",
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440071",
      "employee": {
        "fullName": "John Smith",
        "serviceNumber": 12345
      }
    }
  ]
}
```

**Intelligent Behavior**:
- If service number belongs to supervisor → returns supervised employees
- If service number belongs to supervisee → returns supervisors
- Supports both guards and employees through `personType` hint
- Reduces need for separate endpoints

---

#### 8. Update Supervisor Assignment

**Endpoint**: `PATCH /employee/update-assigned-supervisor/{assignedSupervisorId}`

**Purpose**: Updates existing supervisor assignment including location, supervisor, client, deployment dates, and active status.

**Authentication**: Bearer token (organizationAdmin, manager roles)

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `assignedSupervisorId` | string (UUID) | UUID of the assignment record |

**Request Body**:
```json
{
  "locationId": "550e8400-e29b-41d4-a716-446655440099",
  "supervisorEmployeeId": "550e8400-e29b-41d4-a716-446655440051",
  "supervisorServiceNumber": null,
  "clientId": "550e8400-e29b-41d4-a716-446655440061",
  "deploymentTill": "2026-12-13",
  "isActive": true
}
```

**Request Parameters** (all optional - provide only fields to update):

| Field | Type | Description |
|-------|------|-------------|
| `locationId` | string (UUID) | New location (optional) |
| `supervisorEmployeeId` | string (UUID) | New supervisor UUID (optional) |
| `supervisorServiceNumber` | integer | New supervisor service number (optional) |
| `clientId` | string (UUID) | New client (optional) |
| `deploymentTill` | string (ISO-8601) | Updated end date (optional) |
| `isActive` | boolean | Active status (optional) |

**Response** (200 OK):
```json
{
  "status": "success",
  "message": "Assignment updated successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440070",
    "locationId": "550e8400-e29b-41d4-a716-446655440099",
    "employeeId": "550e8400-e29b-41d4-a716-446655440040",
    "supervisorEmployeeId": "550e8400-e29b-41d4-a716-446655440051",
    "clientId": "550e8400-e29b-41d4-a716-446655440061",
    "deploymentDate": "2025-11-13",
    "deploymentTill": "2026-12-13",
    "isActive": true,
    "totalWorkingDays": 396
  }
}
```

**Update Patterns**:

Change supervisor:
```json
{
  "supervisorEmployeeId": "550e8400-e29b-41d4-a716-446655440052"
}
```

Deactivate assignment:
```json
{
  "isActive": false
}
```

Extend deployment:
```json
{
  "deploymentTill": "2027-11-13"
}
```

---

### Location Deployment Operations

#### 9. Get Guards Assigned to Location

**Endpoint**: `GET /location/assigned-guard/{locationId}`

**Purpose**: Returns all currently deployed guards at the location with shift details, category, and calculated working days.

**Authentication**: Bearer token (any role)

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `locationId` | string (UUID) | UUID of the location |

**Example Request**:
```
GET /location/assigned-guard/550e8400-e29b-41d4-a716-446655440020
```

**Response** (200 OK):
```json
{
  "status": "success",
  "message": "Assigned guards retrieved",
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440050",
      "guard": {
        "id": "550e8400-e29b-41d4-a716-446655440040",
        "fullName": "John Smith",
        "serviceNumber": 12345,
        "contactNumber": "+1-555-0101"
      },
      "guardCategory": {
        "id": "550e8400-e29b-41d4-a716-446655440030",
        "categoryName": "Armed"
      },
      "deploymentDate": "2025-11-13",
      "deploymentTill": "2025-12-13",
      "totalWorkingDays": 30,
      "shift": {
        "id": "550e8400-e29b-41d4-a716-446655440080",
        "shiftName": "Day Shift",
        "startTime": "08:00",
        "endTime": "16:00"
      }
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440051",
      "guard": {
        "id": "550e8400-e29b-41d4-a716-446655440041",
        "fullName": "Jane Doe",
        "serviceNumber": 12346,
        "contactNumber": "+1-555-0102"
      },
      "guardCategory": {
        "id": "550e8400-e29b-41d4-a716-446655440030",
        "categoryName": "Armed"
      },
      "deploymentDate": "2025-11-13",
      "deploymentTill": "2025-12-13",
      "totalWorkingDays": 30,
      "shift": {
        "id": "550e8400-e29b-41d4-a716-446655440081",
        "shiftName": "Night Shift",
        "startTime": "16:00",
        "endTime": "00:00"
      }
    }
  ]
}
```

**Use Cases**:
- View current guard roster at location
- Monitor shift coverage
- Calculate payroll
- Access guard contact information

**Filtering**:
- Supervisors see only their locations (if supervisor role)
- Managers see all locations
- Guards filtered by deployment dates

---

#### 10. Get Requested Guards for Location

**Endpoint**: `GET /location/requested-guards/{locationId}`

**Purpose**: Returns the guard requirements/requests for a location including quantity, category, and shift information.

**Authentication**: Bearer token (any role)

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `locationId` | string (UUID) | UUID of the location |

**Example Request**:
```
GET /location/requested-guards/550e8400-e29b-41d4-a716-446655440020
```

**Response** (200 OK):
```json
{
  "status": "success",
  "message": "Requested guards retrieved",
  "data": {
    "count": 3,
    "requestedGuards": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440010",
        "quantity": 2,
        "guardCategory": {
          "categoryName": "Armed"
        },
        "shift": {
          "shiftName": "Day Shift"
        }
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440011",
        "quantity": 1,
        "guardCategory": {
          "categoryName": "Unarmed"
        },
        "shift": {
          "shiftName": "Night Shift"
        }
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440012",
        "quantity": 1,
        "guardCategory": {
          "categoryName": "Armed"
        },
        "shift": {
          "shiftName": "Evening Shift"
        }
      }
    ]
  }
}
```

**Data Fields**:

| Field | Description |
|-------|-------------|
| `count` | Total number of requested guard slots |
| `quantity` | Number of guards needed for this request |
| `guardCategory` | Category requirements (Armed, Unarmed, etc.) |
| `shift` | Shift information (timing, name) |

**Business Use**:
- Plan guard allocation
- Identify staffing gaps
- Compare requests vs. assignments
- Generate allocation reports

---

#### 11. Get Locations Managed by Supervisor

**Endpoint**: `GET /location/by-supervisor/{supervisorEmployeeId}`

**Purpose**: Returns all locations where the specified employee is assigned as supervisor, including guard counts and client details.

**Authentication**: Bearer token (any role)

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `supervisorEmployeeId` | string (UUID) | UUID of the supervisor employee |

**Example Request**:
```
GET /location/by-supervisor/550e8400-e29b-41d4-a716-446655440050
```

**Response** (200 OK):
```json
{
  "status": "success",
  "message": "Supervisor locations retrieved",
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440020",
      "locationName": "Downtown Office",
      "address": "123 Main St, Downtown",
      "client": {
        "id": "550e8400-e29b-41d4-a716-446655440060",
        "companyName": "Acme Corporation",
        "contractNumber": "ACC-2025-001"
      },
      "guards": {
        "totalCount": 3,
        "list": [
          {
            "id": "550e8400-e29b-41d4-a716-446655440040",
            "fullName": "John Smith",
            "serviceNumber": 12345,
            "contactNumber": "+1-555-0101"
          },
          {
            "id": "550e8400-e29b-41d4-a716-446655440041",
            "fullName": "Jane Doe",
            "serviceNumber": 12346,
            "contactNumber": "+1-555-0102"
          },
          {
            "id": "550e8400-e29b-41d4-a716-446655440042",
            "fullName": "Bob Johnson",
            "serviceNumber": 12347,
            "contactNumber": "+1-555-0103"
          }
        ]
      }
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440099",
      "locationName": "Uptown Plaza",
      "address": "456 Oak Ave, Uptown",
      "client": {
        "id": "550e8400-e29b-41d4-a716-446655440061",
        "companyName": "Global Security Inc.",
        "contractNumber": "GSI-2025-002"
      },
      "guards": {
        "totalCount": 2,
        "list": [
          {
            "id": "550e8400-e29b-41d4-a716-446655440043",
            "fullName": "Alice Brown",
            "serviceNumber": 12348,
            "contactNumber": "+1-555-0104"
          },
          {
            "id": "550e8400-e29b-41d4-a716-446655440044",
            "fullName": "Charlie Wilson",
            "serviceNumber": 12349,
            "contactNumber": "+1-555-0105"
          }
        ]
      }
    }
  ]
}
```

**Response Structure**:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Location ID |
| `locationName` | string | Name of the location |
| `address` | string | Physical address |
| `client` | object | Client information |
| `guards.totalCount` | integer | Total guards deployed |
| `guards.list` | array | Guard detail records |

**Use Cases**:
- Dashboard for supervisors viewing their assignments
- Generate supervision reports
- Monitor team composition
- Access guard contact details for coordination

---

## Common Workflows

### Workflow 1: Complete Guard Deployment

1. **GET** `/location/requested-guards/{locationId}` → See guard requirements
2. **POST** `/guards/assign-guard` → Assign guard to fulfill requirement
3. **GET** `/location/assigned-guard/{locationId}` → Verify deployment
4. **GET** `/guards/assigned-guard?guardId={guardId}` → Check guard status

### Workflow 2: Create Supervisory Structure

1. **POST** `/guards/promote-to-supervisor?guardId={id}&personType=guard` → Promote to supervisor
2. **POST** `/employee/assign-supervisor` → Link supervisors to employees
3. **GET** `/location/by-supervisor/{supervisorId}` → View supervisor's locations
4. **PATCH** `/employee/update-assigned-supervisor/{id}` → Update assignments as needed

### Workflow 3: Monitor Location Deployment

1. **GET** `/location/assigned-guard/{locationId}` → Current guards
2. **GET** `/location/requested-guards/{locationId}` → Requirements
3. **Analyze** differences between assigned and requested
4. **POST** `/guards/assign-guard` → Fill gaps if needed

### Workflow 4: Supervisor Reassignment

1. **GET** `/employee/get-assigned-supervisors/{employeeId}` → Current supervisors
2. **PATCH** `/employee/update-assigned-supervisor/{assignmentId}` → Change supervisor
3. **Verify** new supervisor has appropriate access
4. **Monitor** transition period

---

## Error Handling

### Common Error Scenarios

**Missing Required Parameter**:
```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": [
    {
      "field": "guardId",
      "message": "Either guardId or serviceNumber must be provided"
    }
  ]
}
```

**Resource Not Found**:
```json
{
  "status": "error",
  "message": "Guard not found with the provided ID or service number"
}
```

**Business Rule Violation**:
```json
{
  "status": "error",
  "message": "Guard already assigned to this location during overlapping period",
  "errors": [
    {
      "field": "guardId",
      "message": "Deployment conflict: 2025-11-15 to 2025-12-15"
    }
  ]
}
```

**Unauthorized**:
```json
{
  "status": "error",
  "message": "Unauthorized access"
}
```

**Insufficient Permissions**:
```json
{
  "status": "error",
  "message": "You do not have permission to access this resource"
}
```

### Debugging Tips

1. **Verify Authentication**: Check `Authorization` header contains valid JWT
2. **Check Role**: Confirm user role permits the operation
3. **Validate IDs**: Use GET endpoints to verify UUID existence before operations
4. **Test Sequence**: Follow workflow examples to build operations incrementally
5. **Review Logs**: Backend logs contain detailed error messages for debugging

---

## API Specification Files

### Postman Collection

File: `deployment-module-postman.json`

**Import into Postman**:
1. Open Postman
2. Click **Import**
3. Select **File** tab
4. Choose `deployment-module-postman.json`
5. Collection loads with all 11 endpoints pre-configured

**Features**:
- Complete request templates with sample data
- Automatic token management via test scripts
- Environment variables for multi-environment testing
- Pre-built test assertions on responses

### OpenAPI Specification

File: `deployment-module-openapi.yaml`

**Usage**:
1. **View Documentation**: Paste YAML into [Swagger Editor](https://editor.swagger.io/)
2. **Generate Client**: Use [OpenAPI Generator](https://openapi-generator.tech/) to create SDKs
3. **API Documentation**: Host specification for developer reference
4. **Tool Integration**: Use with API testing tools (Postman, Insomnia)

**Specification Includes**:
- Complete endpoint definitions
- Parameter descriptions
- Request/response schemas
- Authentication requirements
- Error responses

---

## Best Practices

### Authentication

✅ **DO**:
- Store tokens securely (not in localStorage for sensitive apps)
- Include token in every request Authorization header
- Regenerate tokens periodically (per your security policy)
- Use HTTPS in production (always)

❌ **DON'T**:
- Share tokens across users
- Log tokens to console in production
- Include tokens in URL parameters
- Commit tokens to version control

### Error Handling

✅ **DO**:
- Check response `status` field before processing `data`
- Validate all required parameters before sending
- Use provided error messages for user feedback
- Retry transient errors (5xx) with exponential backoff

❌ **DON'T**:
- Assume success without checking status
- Parse `data` field without error checking
- Display raw error objects to end-users
- Ignore status codes

### API Usage

✅ **DO**:
- Cache stable data (location list, guard categories)
- Use conditional requests (check existence before POST)
- Batch related operations efficiently
- Monitor rate limits (if applicable)

❌ **DON'T**:
- Make unnecessary repeated requests
- Ignore response schemas
- Update without verifying current state
- Use GET requests for modifications

---

## Support & Resources

**Documentation Files**:
- `deployment-module-postman.json` - Postman collection for testing
- `deployment-module-openapi.yaml` - OpenAPI 3.0 specification
- `deployment-module-README.md` - This comprehensive guide

**Related Documentation**:
- User Guide (end-user operations)
- Testing Guide (comprehensive testing procedures)
- Deployment Guide (production setup)

**Contact**:
- API Support: api-support@guardsos.com
- Documentation Issues: docs-team@guardsos.com

---

## Appendix: Data Type Definitions

### UUID Format
Universally Unique Identifier following RFC 4122:
```
550e8400-e29b-41d4-a716-446655440000
```

### ISO-8601 DateTime
Full timestamp including timezone:
```
2025-11-13T10:30:00Z
2025-11-13T10:30:00+00:00
```

### ISO-8601 Date
Date without time component:
```
2025-11-13
```

### Service Number
Integer identifier for personnel:
```
12345
```

---

**Last Updated**: November 13, 2025  
**API Version**: 1.0.0  
**Status**: Production Ready
