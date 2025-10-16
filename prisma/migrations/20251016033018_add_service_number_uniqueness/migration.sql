-- CreateEnum
CREATE TYPE "public"."AttendanceType" AS ENUM ('P', 'A', 'R', 'L');

-- CreateEnum
CREATE TYPE "public"."DeductionType" AS ENUM ('sessiPessiFund', 'eobiFund', 'insurance', 'advances', 'loanRepayment', 'penalty', 'miscCharges');

-- CreateTable
CREATE TABLE "public"."User" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "profileImage" TEXT,
    "id" UUID NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Role" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "roleName" TEXT NOT NULL,
    "id" UUID NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserRole" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Organization" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationName" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "organizationLogo" TEXT,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Office" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "province" TEXT NOT NULL,
    "contactNumber" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "addressOpt" TEXT,
    "city" TEXT NOT NULL DEFAULT 'N/A',
    "branchName" TEXT NOT NULL DEFAULT 'N/A',
    "contactNumberOpt" TEXT,
    "branchCode" SERIAL NOT NULL,

    CONSTRAINT "Office_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrganizationBankAccount" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "bankName" TEXT,
    "bankCode" TEXT,
    "accountNumber" TEXT,
    "accountTitle" TEXT,
    "IBAN" TEXT,
    "branchCode" TEXT,
    "branch" TEXT,

    CONSTRAINT "OrganizationBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserOffice" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "officeId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserOffice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GuardCategory" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "categoryName" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,

    CONSTRAINT "GuardCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Employee" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "organizationId" UUID NOT NULL,
    "registrationDate" TIMESTAMP(3),
    "fullName" TEXT NOT NULL,
    "fatherName" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "cnicNumber" TEXT NOT NULL,
    "cnicIssueDate" TIMESTAMP(3) NOT NULL,
    "currentAddress" TEXT,
    "permanentAddress" TEXT,
    "weight" DOUBLE PRECISION,
    "height" DOUBLE PRECISION NOT NULL,
    "religion" TEXT,
    "bloodGroup" TEXT,
    "bloodPressure" TEXT,
    "heartBeat" TEXT,
    "eyeColor" TEXT,
    "disability" TEXT,
    "eobiNumber" TEXT,
    "sessiNumber" TEXT,
    "kinName" TEXT,
    "kinFatherName" TEXT,
    "kinCNIC" TEXT,
    "serviceNumber" INTEGER NOT NULL,
    "cnicExpiryDate" TIMESTAMP(3) NOT NULL,
    "contactNumber" TEXT NOT NULL DEFAULT 'N/A',
    "kinContactNumber" TEXT DEFAULT 'N/A',
    "religionSect" TEXT DEFAULT 'N/A',
    "kinRelation" TEXT DEFAULT 'N/A',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Guard" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "registrationDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "fullName" TEXT NOT NULL,
    "fatherName" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "cnicNumber" TEXT NOT NULL,
    "cnicIssueDate" TIMESTAMP(3) NOT NULL,
    "currentAddress" TEXT,
    "permanentAddress" TEXT,
    "weight" DOUBLE PRECISION,
    "height" DOUBLE PRECISION NOT NULL,
    "religion" TEXT,
    "bloodGroup" TEXT,
    "bloodPressure" TEXT,
    "heartBeat" TEXT,
    "eyeColor" TEXT,
    "disability" TEXT,
    "eobiNumber" TEXT,
    "sessiNumber" TEXT,
    "kinName" TEXT,
    "kinFatherName" TEXT,
    "kinCNIC" TEXT,
    "serviceNumber" INTEGER NOT NULL,
    "cnicExpiryDate" TIMESTAMP(3),
    "contactNumber" TEXT NOT NULL DEFAULT 'N/A',
    "currentAreaPoliceContact" TEXT DEFAULT 'N/A',
    "currentAreaPoliceStation" TEXT DEFAULT 'N/A',
    "kinRelation" TEXT NOT NULL DEFAULT 'N/A',
    "permanentAreaPoliceContact" TEXT DEFAULT 'N/A',
    "permanentAreaPoliceStation" TEXT DEFAULT 'N/A',
    "religionSect" TEXT DEFAULT 'N/A',
    "kinContactNumber" TEXT DEFAULT 'N/A',
    "officeId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Guard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Academic" (
    "id" UUID NOT NULL,
    "employeeId" UUID,
    "lastEducation" TEXT,
    "institute" TEXT,
    "hasDrivingLicense" BOOLEAN,
    "guardId" UUID,

    CONSTRAINT "Academic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DrivingLicense" (
    "id" UUID NOT NULL,
    "employeeId" UUID,
    "drivingLicenseNo" TEXT,
    "drivingLicenseIssueDate" TIMESTAMP(3),
    "drivingLicenseExpiryDate" TIMESTAMP(3),
    "licenseIssueCity" TEXT,
    "guardId" UUID,

    CONSTRAINT "DrivingLicense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GuardExperience" (
    "id" UUID NOT NULL,
    "guardId" UUID,
    "isExServiceMen" BOOLEAN NOT NULL,
    "exServiceDischargeNumber" TEXT,
    "armyNumber" TEXT,
    "branch" TEXT,
    "serviceYears" INTEGER,
    "serviceMonths" INTEGER,
    "securityYears" INTEGER,
    "place" TEXT,
    "unit" TEXT,
    "recentCivilEmployment" TEXT,
    "rankName" TEXT,

    CONSTRAINT "GuardExperience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmployeeExperience" (
    "id" UUID NOT NULL,
    "employeeId" UUID,
    "recentCivilEmployment" TEXT,
    "placeOfDuty" TEXT,
    "totalYears" INTEGER,

    CONSTRAINT "EmployeeExperience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Reference" (
    "id" UUID NOT NULL,
    "employeeId" UUID,
    "fullName" TEXT NOT NULL,
    "fatherName" TEXT,
    "cnicNumber" TEXT NOT NULL,
    "contactNumber" TEXT,
    "relationship" TEXT,
    "currentAddress" TEXT,
    "permanentAddress" TEXT,
    "guardId" UUID,
    "cnicBack" TEXT DEFAULT 'N/A',
    "cnicFront" TEXT DEFAULT 'N/A',

    CONSTRAINT "Reference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BankAccount" (
    "id" UUID NOT NULL,
    "employeeId" UUID,
    "bankName" TEXT,
    "bankCode" TEXT,
    "accountNumber" TEXT,
    "IBAN" TEXT,
    "branchCode" TEXT,
    "branch" TEXT,
    "guardId" UUID,
    "accountTitle" TEXT,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmployeeDocuments" (
    "id" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "picture" TEXT NOT NULL,
    "cnicFront" TEXT NOT NULL,
    "cnicBack" TEXT NOT NULL,
    "licenseFront" TEXT,
    "licenseBack" TEXT,

    CONSTRAINT "EmployeeDocuments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GuardDocuments" (
    "id" UUID NOT NULL,
    "guardId" UUID,
    "picture" TEXT NOT NULL,
    "cnicFront" TEXT NOT NULL,
    "cnicBack" TEXT NOT NULL,
    "licenseFront" TEXT,
    "licenseBack" TEXT,
    "policeVerification" TEXT,
    "specialBranchVerification" TEXT,
    "dischargeBook" TEXT,
    "NadraVeriSys" TEXT,
    "NadraVeriSysRef1" TEXT,
    "NadraVeriSysRef2" TEXT,
    "healthCertificate" TEXT,
    "medicalDocument" TEXT,
    "DDCDriving" TEXT,
    "educationCertificate" TEXT,
    "APSAATrainingCertificate" TEXT,
    "misc1" TEXT,
    "misc2" TEXT,
    "originalCNICSubmitted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GuardDocuments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Biometric" (
    "id" UUID NOT NULL,
    "employeeId" UUID,
    "rightThumb" TEXT,
    "rightMiddleFinger" TEXT,
    "rightLittleFinger" TEXT,
    "leftThumb" TEXT,
    "leftMiddleFinger" TEXT,
    "leftLittleFinger" TEXT,
    "rightForeFinger" TEXT,
    "rightRingFinger" TEXT,
    "rightFourFinger" TEXT,
    "leftFourFinger" TEXT,
    "leftRingFinger" TEXT,
    "guardId" UUID,
    "leftForeFinger" TEXT NOT NULL DEFAULT 'Left Fore Finger',

    CONSTRAINT "Biometric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Client" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "recruitmentDate" TIMESTAMP(3) NOT NULL,
    "companyName" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "websiteLink" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "currentAddress" TEXT NOT NULL,
    "contactNumber" TEXT NOT NULL,
    "officialEmail" TEXT NOT NULL,
    "POCName" TEXT,
    "POCDesignation" TEXT,
    "POCEmail" TEXT,
    "POCContact" TEXT,
    "AlternateContactPerson" TEXT,
    "AlternateContactNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "contractFile" TEXT DEFAULT 'N/A',
    "contractNumber" SERIAL NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."shifts" (
    "id" UUID NOT NULL,
    "shiftName" TEXT NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."location_types" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "location_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."locations" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "locationName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "provinceState" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "GPScoordinate" TEXT,
    "authorizedPersonName" TEXT,
    "authorizedPersonNumber" TEXT,
    "authorizedPersonDesignation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdLocationId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "locationTypeId" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "officeId" UUID,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."requested_guards" (
    "id" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "guardCategoryId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "shiftId" UUID NOT NULL,
    "allowance" DOUBLE PRECISION NOT NULL,
    "chargesPerMonth" DOUBLE PRECISION NOT NULL,
    "overtimePerHour" DOUBLE PRECISION NOT NULL,
    "gazettedHoliday" INTEGER,

    CONSTRAINT "requested_guards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."requested_guard_finances" (
    "id" UUID NOT NULL,
    "requestedGuardId" UUID NOT NULL,
    "salaryPerMonth" DOUBLE PRECISION NOT NULL,
    "allowance" DOUBLE PRECISION NOT NULL,
    "overtimePerHour" DOUBLE PRECISION NOT NULL,
    "gazettedHoliday" INTEGER,

    CONSTRAINT "requested_guard_finances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LocationTaxes" (
    "id" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "taxType" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION,
    "amount" DOUBLE PRECISION,
    "addInvoice" BOOLEAN NOT NULL,

    CONSTRAINT "LocationTaxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AssignedGuard" (
    "id" UUID NOT NULL,
    "guardId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "requestedGuardId" UUID NOT NULL,
    "deploymentDate" TIMESTAMP(3) NOT NULL,
    "deploymentTill" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "guardCategoryId" UUID NOT NULL,

    CONSTRAINT "AssignedGuard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AssignedSupervisor" (
    "id" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "deploymentDate" TIMESTAMP(3) NOT NULL,
    "deploymentTill" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignedSupervisor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GuardsAttendance" (
    "id" UUID NOT NULL,
    "type" "public"."AttendanceType" NOT NULL,
    "locationId" UUID NOT NULL,
    "guardId" UUID NOT NULL,
    "shiftId" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "isHoliday" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardsAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GuardAllowances" (
    "id" UUID NOT NULL,
    "guardId" UUID NOT NULL,
    "allowancePercentage" DOUBLE PRECISION NOT NULL,
    "holidayCount" INTEGER NOT NULL,
    "overTimeCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "requestedGuardId" UUID NOT NULL,
    "locationPayrollDurationId" UUID NOT NULL,

    CONSTRAINT "GuardAllowances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LocationPayRollDuration" (
    "id" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "totalDays" INTEGER NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT true,
    "nextUnlockTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocationPayRollDuration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GuardDeductions" (
    "id" UUID NOT NULL,
    "guardId" UUID NOT NULL,
    "deductionType" "public"."DeductionType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "locationId" UUID NOT NULL,

    CONSTRAINT "GuardDeductions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "public"."UserRole"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_userId_key" ON "public"."Organization"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserOffice_userId_organizationId_officeId_key" ON "public"."UserOffice"("userId", "organizationId", "officeId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_cnicNumber_key" ON "public"."Employee"("cnicNumber");

-- CreateIndex
CREATE UNIQUE INDEX "unique_employee_org_service" ON "public"."Employee"("organizationId", "serviceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Guard_cnicNumber_key" ON "public"."Guard"("cnicNumber");

-- CreateIndex
CREATE UNIQUE INDEX "unique_guard_org_service" ON "public"."Guard"("organizationId", "serviceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Academic_employeeId_key" ON "public"."Academic"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Academic_guardId_key" ON "public"."Academic"("guardId");

-- CreateIndex
CREATE UNIQUE INDEX "DrivingLicense_employeeId_key" ON "public"."DrivingLicense"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "DrivingLicense_guardId_key" ON "public"."DrivingLicense"("guardId");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_employeeId_key" ON "public"."BankAccount"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_guardId_key" ON "public"."BankAccount"("guardId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeDocuments_employeeId_key" ON "public"."EmployeeDocuments"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "GuardDocuments_guardId_key" ON "public"."GuardDocuments"("guardId");

-- CreateIndex
CREATE UNIQUE INDEX "Biometric_employeeId_key" ON "public"."Biometric"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Biometric_guardId_key" ON "public"."Biometric"("guardId");

-- CreateIndex
CREATE UNIQUE INDEX "Client_officialEmail_key" ON "public"."Client"("officialEmail");

-- CreateIndex
CREATE UNIQUE INDEX "requested_guard_finances_requestedGuardId_key" ON "public"."requested_guard_finances"("requestedGuardId");

-- AddForeignKey
ALTER TABLE "public"."UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Organization" ADD CONSTRAINT "Organization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Office" ADD CONSTRAINT "Office_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrganizationBankAccount" ADD CONSTRAINT "OrganizationBankAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserOffice" ADD CONSTRAINT "UserOffice_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "public"."Office"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserOffice" ADD CONSTRAINT "UserOffice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserOffice" ADD CONSTRAINT "UserOffice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuardCategory" ADD CONSTRAINT "GuardCategory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Employee" ADD CONSTRAINT "Employee_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Guard" ADD CONSTRAINT "Guard_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "public"."Office"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Guard" ADD CONSTRAINT "Guard_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Academic" ADD CONSTRAINT "Academic_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Academic" ADD CONSTRAINT "Academic_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "public"."Guard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DrivingLicense" ADD CONSTRAINT "DrivingLicense_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DrivingLicense" ADD CONSTRAINT "DrivingLicense_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "public"."Guard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuardExperience" ADD CONSTRAINT "GuardExperience_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "public"."Guard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmployeeExperience" ADD CONSTRAINT "EmployeeExperience_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reference" ADD CONSTRAINT "Reference_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reference" ADD CONSTRAINT "Reference_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "public"."Guard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BankAccount" ADD CONSTRAINT "BankAccount_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BankAccount" ADD CONSTRAINT "BankAccount_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "public"."Guard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmployeeDocuments" ADD CONSTRAINT "EmployeeDocuments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuardDocuments" ADD CONSTRAINT "GuardDocuments_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "public"."Guard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Biometric" ADD CONSTRAINT "Biometric_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Biometric" ADD CONSTRAINT "Biometric_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "public"."Guard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Client" ADD CONSTRAINT "Client_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."locations" ADD CONSTRAINT "locations_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."locations" ADD CONSTRAINT "locations_locationTypeId_fkey" FOREIGN KEY ("locationTypeId") REFERENCES "public"."location_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."locations" ADD CONSTRAINT "locations_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "public"."Office"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requested_guards" ADD CONSTRAINT "requested_guards_guardCategoryId_fkey" FOREIGN KEY ("guardCategoryId") REFERENCES "public"."GuardCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requested_guards" ADD CONSTRAINT "requested_guards_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requested_guards" ADD CONSTRAINT "requested_guards_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "public"."shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requested_guard_finances" ADD CONSTRAINT "requested_guard_finances_requestedGuardId_fkey" FOREIGN KEY ("requestedGuardId") REFERENCES "public"."requested_guards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LocationTaxes" ADD CONSTRAINT "LocationTaxes_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssignedGuard" ADD CONSTRAINT "AssignedGuard_guardCategoryId_fkey" FOREIGN KEY ("guardCategoryId") REFERENCES "public"."GuardCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssignedGuard" ADD CONSTRAINT "AssignedGuard_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "public"."Guard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssignedGuard" ADD CONSTRAINT "AssignedGuard_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssignedGuard" ADD CONSTRAINT "AssignedGuard_requestedGuardId_fkey" FOREIGN KEY ("requestedGuardId") REFERENCES "public"."requested_guards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssignedSupervisor" ADD CONSTRAINT "AssignedSupervisor_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssignedSupervisor" ADD CONSTRAINT "AssignedSupervisor_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssignedSupervisor" ADD CONSTRAINT "AssignedSupervisor_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuardsAttendance" ADD CONSTRAINT "GuardsAttendance_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "public"."Guard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuardsAttendance" ADD CONSTRAINT "GuardsAttendance_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuardsAttendance" ADD CONSTRAINT "GuardsAttendance_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "public"."shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuardAllowances" ADD CONSTRAINT "GuardAllowances_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "public"."Guard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuardAllowances" ADD CONSTRAINT "GuardAllowances_locationPayrollDurationId_fkey" FOREIGN KEY ("locationPayrollDurationId") REFERENCES "public"."LocationPayRollDuration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuardAllowances" ADD CONSTRAINT "GuardAllowances_requestedGuardId_fkey" FOREIGN KEY ("requestedGuardId") REFERENCES "public"."requested_guards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LocationPayRollDuration" ADD CONSTRAINT "LocationPayRollDuration_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuardDeductions" ADD CONSTRAINT "GuardDeductions_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "public"."Guard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuardDeductions" ADD CONSTRAINT "GuardDeductions_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
