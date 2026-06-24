// ...existing code...
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateGuardDto } from './dto/create-guard-dto';
import { UpdateGuardDto } from './dto/update-guard-dto';
import { handlePrismaError } from 'src/common/utils/prisma-error-handler';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { FileService } from 'src/file/file.service';
import { AssignGuardDto } from './dto/assigned-guard-dto';
import { EmployeeService } from 'src/employee/employee.service';
import { RolesEnum } from 'src/common/enums/roles-enum';
import { shouldFilterByOffice, getSupervisorLocationFilter } from 'src/common/utils/office-filter';
import { PromoteSupervisorDto } from './dto/promote-supervisor.dto';
import { buildBiometricStatus } from 'src/biometric/biometric-status.util';
import { buildBiometricCaptures } from 'src/biometric/biometric-captures.util';
import {
  formatDateFieldLabel,
  parseFlexibleDate,
} from 'src/common/utils/parse-flexible-date';
import { Prisma } from '@prisma/client';

@Injectable()
export class GuardService {
  constructor(
    private readonly fileService: FileService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => EmployeeService))
    private readonly employeeService: EmployeeService,
  ) {}

  // Office filtering delegated to shared helper `shouldFilterByOffice`.
  // Use shouldFilterByOffice(user, { allowStaff: true }) in this service so
  // that both managers and staff are restricted to their office when accessing
  // guard-related endpoints.

  /**
   * Resolve or create an Employee record for a Guard
   * @param guardId ID of the guard
   * @param organizationId Organization ID for security scope
   * @param createIfNotExists Whether to create an Employee record if none exists
   * @returns Employee record ID or null if not found and createIfNotExists is false
   */
  public async resolveEmployeeIdForGuard(
    guardId: string,
    organizationId: string,
    createIfNotExists: boolean = true,
  ): Promise<string | null> {
    return this.getOrCreateEmployeeForGuard(
      guardId,
      organizationId,
      createIfNotExists,
    );
  }

  /**
   * Helper function to get or create an Employee record for a Guard
   * @param guardId ID of the guard
   * @param organizationId Organization ID for security scope
   * @param createIfNotExists Whether to create an Employee record if none exists
   * @returns Employee record ID or null if not found and createIfNotExists is false
   */
  private async getOrCreateEmployeeForGuard(
    guardId: string,
    organizationId: string,
    createIfNotExists: boolean = true,
  ): Promise<string | null> {
    // First check if there's an Employee already linked via userId
    const guard = await this.prisma.guard.findUnique({
      where: { id: guardId },
      include: { user: true },
    });

    if (!guard) {
      throw new NotFoundException(`Guard with ID ${guardId} not found`);
    }

    if (guard.user) {
      // If guard has a user, look for an employee with the same userId
      const existingEmployee = await this.prisma.employee.findFirst({
        where: { userId: guard.user.id },
      });
      if (existingEmployee) {
        return existingEmployee.id;
      }
    }

    // No existing employee found
    if (!createIfNotExists) {
      return null;
    }

    // Create a minimal employee record
    const employee = await this.prisma.employee.create({
      data: {
        organizationId,
        fullName: guard.fullName,
        serviceNumber: guard.serviceNumber,
        cnicNumber: guard.cnicNumber,
        // Required fields from schema
        fatherName: guard.fatherName || 'N/A',
        cnicIssueDate: guard.cnicIssueDate,
        contactNumber: guard.contactNumber || 'N/A',
        currentAddress: guard.currentAddress || 'N/A',
        height: guard.height || 170, // Default height if none provided
        cnicExpiryDate:
          guard.cnicExpiryDate ||
          new Date(new Date().setFullYear(new Date().getFullYear() + 10)), // Default 10 years from now if none provided
        isActive: true,
        // Link to the same user if one exists
        userId: guard.user?.id,
      },
    });

    return employee.id;
  }

  async bulkUploadGuards(
    organizationId: string,
    officeId: string,
    guards: any[],
  ) {
    try {
      console.log('=== Bulk Upload Started ===');
      console.log('Organization ID:', organizationId);
      console.log('Office ID:', officeId);
      console.log('Number of guards:', guards.length);
      console.log('Guards data sample:', guards[0]);

      if (!Array.isArray(guards) || guards.length === 0) {
        return { success: false, message: 'No guards data provided.' };
      }

      // Validate and map guards
      const requiredFields = [
        'fullName',
        'cnicNumber',
        'cnicIssueDate',
        'height',
        'serviceNumber',
      ];
      const now = new Date();
      type GuardInput = {
        id?: string;
        organizationId: string;
        officeId?: string;
        registrationDate?: Date;
        fullName: string;
        fatherName?: string;
        dateOfBirth?: Date | null;
        cnicNumber: string;
        cnicIssueDate: Date;
        currentAddress?: string;
        permanentAddress?: string;
        weight?: number | null;
        height: number;
        religion?: string;
        bloodGroup?: string;
        bloodPressure?: string;
        heartBeat?: string;
        eyeColor?: string;
        disability?: string;
        eobiNumber?: string;
        sessiNumber?: string;
        kinName?: string;
        kinFatherName?: string;
        kinCNIC?: string;
        serviceNumber: number;
        cnicExpiryDate?: Date | null;
        contactNumber?: string;
        currentAreaPoliceContact?: string;
        currentAreaPoliceStation?: string;
        kinRelation?: string;
        permanentAreaPoliceContact?: string;
        permanentAreaPoliceStation?: string;
        religionSect?: string;
        kinContactNumber?: string;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
      };

      // Step 1: Initial validation and mapping
      const guardsToCreate: GuardInput[] = [];
      const validationErrors: {
        row: number;
        missing: string[];
        errors?: string[];
      }[] = [];
      const duplicatesInCsv = new Set<string>();
      const seenCnicNumbers = new Set<string>();
      const seenServiceNumbers = new Set<number>();

      console.log('Validating guards data...');

      for (let i = 0; i < guards.length; i++) {
        const g = guards[i];
        const errors: string[] = [];

        // Check required fields (trim whitespace from CSV values)
        const missing = requiredFields.filter((f) => {
          const value = g[f];
          return value == null || String(value).trim() === '';
        });
        if (missing.length > 0) {
          validationErrors.push({
            row: i + 1,
            missing,
            errors: missing.map((field) => `Missing ${formatDateFieldLabel(field)}`),
          });
          continue;
        }

        const cnicIssueDate = parseFlexibleDate(g.cnicIssueDate);
        if (!cnicIssueDate) {
          errors.push(
            `Invalid CNIC Issue Date "${g.cnicIssueDate}". Use DD/MM/YYYY or YYYY-MM-DD`,
          );
        }

        const cnicExpiryDate = g.cnicExpiryDate
          ? parseFlexibleDate(g.cnicExpiryDate)
          : null;
        if (g.cnicExpiryDate && !cnicExpiryDate) {
          errors.push(
            `Invalid CNIC Expiry Date "${g.cnicExpiryDate}". Use DD/MM/YYYY or YYYY-MM-DD`,
          );
        }

        const dateOfBirth = g.dateOfBirth
          ? parseFlexibleDate(g.dateOfBirth)
          : null;
        if (g.dateOfBirth && !dateOfBirth) {
          errors.push(
            `Invalid Date of Birth "${g.dateOfBirth}". Use DD/MM/YYYY or YYYY-MM-DD`,
          );
        }

        const registrationDate = g.registrationDate
          ? parseFlexibleDate(g.registrationDate)
          : null;
        if (g.registrationDate && !registrationDate) {
          errors.push(
            `Invalid Registration Date "${g.registrationDate}". Use DD/MM/YYYY or YYYY-MM-DD`,
          );
        }

        const parsedHeight = Number(g.height);
        if (Number.isNaN(parsedHeight)) {
          errors.push(`Invalid height "${g.height}"`);
        }

        const parsedServiceNumber = Number(g.serviceNumber);
        if (Number.isNaN(parsedServiceNumber)) {
          errors.push(`Invalid service number "${g.serviceNumber}"`);
        }

        // Check for duplicates within CSV
        const cnicNumber = String(g.cnicNumber).trim();
        if (seenCnicNumbers.has(cnicNumber)) {
          duplicatesInCsv.add(cnicNumber);
          errors.push('Duplicate CNIC number in CSV');
        }
        if (!Number.isNaN(parsedServiceNumber) && seenServiceNumbers.has(parsedServiceNumber)) {
          errors.push('Duplicate service number in CSV');
        }

        if (errors.length > 0) {
          validationErrors.push({ row: i + 1, missing: [], errors });
          continue;
        }

        seenCnicNumbers.add(cnicNumber);
        seenServiceNumbers.add(parsedServiceNumber);

        guardsToCreate.push({
          id: undefined,
          organizationId,
          officeId,
          registrationDate: registrationDate ?? now,
          fullName: String(g.fullName).trim(),
          fatherName: g.fatherName ? String(g.fatherName).trim() : '',
          dateOfBirth,
          cnicNumber,
          cnicIssueDate: cnicIssueDate!,
          currentAddress: g.currentAddress ? String(g.currentAddress).trim() : '',
          permanentAddress: g.permanentAddress ? String(g.permanentAddress).trim() : '',
          weight: g.weight ? Number(g.weight) : null,
          height: parsedHeight,
          religion: g.religion ? String(g.religion).trim() : '',
          bloodGroup: g.bloodGroup ? String(g.bloodGroup).trim() : '',
          bloodPressure: g.bloodPressure ? String(g.bloodPressure).trim() : '120/80',
          heartBeat: g.heartBeat ? String(g.heartBeat).trim() : '',
          eyeColor: g.eyeColor ? String(g.eyeColor).trim() : '',
          disability: g.disability ? String(g.disability).trim() : '',
          eobiNumber: g.eobiNumber ? String(g.eobiNumber).trim() : '',
          sessiNumber: g.sessiNumber ? String(g.sessiNumber).trim() : '',
          kinName: g.kinName ? String(g.kinName).trim() : '',
          kinFatherName: g.kinFatherName ? String(g.kinFatherName).trim() : '',
          kinCNIC: g.kinCNIC ? String(g.kinCNIC).trim() : '',
          serviceNumber: parsedServiceNumber,
          cnicExpiryDate,
          contactNumber: g.contactNumber ? String(g.contactNumber).trim() : 'N/A',
          currentAreaPoliceContact: g.currentAreaPoliceContact
            ? String(g.currentAreaPoliceContact).trim()
            : 'N/A',
          currentAreaPoliceStation: g.currentAreaPoliceStation
            ? String(g.currentAreaPoliceStation).trim()
            : 'N/A',
          kinRelation: g.kinRelation ? String(g.kinRelation).trim() : 'N/A',
          permanentAreaPoliceContact: g.permanentAreaPoliceContact
            ? String(g.permanentAreaPoliceContact).trim()
            : 'N/A',
          permanentAreaPoliceStation: g.permanentAreaPoliceStation
            ? String(g.permanentAreaPoliceStation).trim()
            : 'N/A',
          religionSect: g.religionSect ? String(g.religionSect).trim() : 'N/A',
          kinContactNumber: g.kinContactNumber
            ? String(g.kinContactNumber).trim()
            : 'N/A',
          createdAt: now,
          isActive: true,
          updatedAt: now,
        });
      }

      if (validationErrors.length > 0) {
        console.log('Validation errors found:', validationErrors);
        throw new BadRequestException({
          message: 'Validation failed',
          errors: validationErrors.map((err) => ({
            row: err.row,
            message: err.errors
              ? err.errors.join(', ')
              : err.missing.map((field) => `Missing ${field}`).join(', '),
          })),
        });
      }

      // Step 2: Check for existing guards in database
      console.log('Checking for existing guards...');
      const [existingByCnic, existingByServiceInOrg] = await Promise.all([
        this.prisma.guard.findMany({
          where: { cnicNumber: { in: Array.from(seenCnicNumbers) } },
          select: { cnicNumber: true, serviceNumber: true },
        }),
        this.prisma.guard.findMany({
          where: {
            organizationId,
            serviceNumber: { in: Array.from(seenServiceNumbers) },
          },
          select: { cnicNumber: true, serviceNumber: true },
        }),
      ]);

      const existingGuards = [
        ...existingByCnic,
        ...existingByServiceInOrg.filter(
          (guard) =>
            !existingByCnic.some(
              (byCnic) => byCnic.serviceNumber === guard.serviceNumber,
            ),
        ),
      ];

      const existingCnicNumbers = new Set(
        existingByCnic.map((g) => g.cnicNumber),
      );
      const existingServiceNumbers = new Set(
        existingByServiceInOrg.map((g) => g.serviceNumber),
      );

      // Filter out guards that already exist and collect validation errors
      const newGuards = guardsToCreate.filter((g) => {
        const cnicDuplicate = existingCnicNumbers.has(g.cnicNumber);
        const serviceDuplicate = existingServiceNumbers.has(g.serviceNumber);
        const isDuplicate = cnicDuplicate || serviceDuplicate;

        if (isDuplicate) {
          const duplicateMessages: string[] = [];
          if (cnicDuplicate) {
            duplicateMessages.push(
              `CNIC ${g.cnicNumber} is already registered in the system`,
            );
          }
          if (serviceDuplicate) {
            duplicateMessages.push(
              `Service number ${g.serviceNumber} already exists in your organization`,
            );
          }

          validationErrors.push({
            row:
              guards.findIndex(
                (row) => String(row.cnicNumber).trim() === g.cnicNumber,
              ) + 1,
            missing: [],
            errors: duplicateMessages,
          });
        }
        return !isDuplicate;
      });

      // If we have any validation errors, throw BadRequestException
      if (validationErrors.length > 0) {
        console.log('=== Validation Errors Found ===');
        console.log(JSON.stringify(validationErrors, null, 2));

        const formattedErrors = validationErrors.map((err) => ({
          row: err.row,
          message:
            err.errors?.join(', ') ||
            err.missing?.map((field) => `Missing ${field}`).join(', ') ||
            'Validation error',
        }));

        console.log('=== Throwing BadRequestException ===');
        console.log(
          JSON.stringify(
            {
              message: 'Validation failed',
              errors: formattedErrors,
            },
            null,
            2,
          ),
        );

        throw new BadRequestException({
          message: 'Validation failed',
          errors: formattedErrors,
        });
      }

      console.log(
        `Found ${existingGuards.length} existing guards, ${newGuards.length} new guards to create`,
      );

      if (newGuards.length === 0) {
        return {
          success: false,
          message: 'No new guards to create - all records already exist',
          duplicates: existingGuards.length,
          errors: validationErrors,
        };
      }

      // Step 3: Insert new guards
      console.log('Creating new guards...');
      const result = await this.prisma.guard.createMany({
        data: newGuards,
        skipDuplicates: false, // We've already handled duplicates
      });

      console.log(`Successfully created ${result.count} new guards`);

      return {
        success: true,
        message: `Successfully created ${result.count} guards`,
        data: {
          inserted: result.count,
          skipped: existingGuards.length,
          total: guards.length,
        },
      };
    } catch (error) {
      console.error('Error in bulkUploadGuards:', error);

      // If this is already a BadRequestException with errors, rethrow it
      const response = error.getResponse();
      const responseErrors =
        typeof response === 'object' &&
        response !== null &&
        Array.isArray((response as { errors?: unknown }).errors)
          ? (response as { errors: { row: number; message: string }[] }).errors
          : null;

      if (error instanceof BadRequestException && responseErrors) {
        throw error;
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const fields = (error.meta?.target as string[] | undefined) ?? [];
        throw new BadRequestException({
          message: 'Validation failed',
          errors: [
            {
              row: 1,
              message: fields.includes('cnicNumber')
                ? 'One or more CNIC numbers in this file are already registered. Remove those rows or update the existing guards.'
                : 'One or more records conflict with existing data in the system.',
            },
          ],
        });
      }

      const rawMessage =
        error instanceof Error ? error.message : 'Unknown upload error';
      const rowMatch = rawMessage.match(/row (\d+)/i);
      const rowNumber = rowMatch ? parseInt(rowMatch[1], 10) : 1;

      let safeMessage = rawMessage;
      if (/unique constraint failed/i.test(rawMessage)) {
        safeMessage = rawMessage.includes('cnicNumber')
          ? 'CNIC number is already registered in the system. Remove this row or update the existing guard.'
          : 'A record in this file already exists in the system.';
      } else if (rawMessage.length > 300) {
        safeMessage =
          'Failed to save guard data. Check for duplicate CNIC or service numbers, and verify all required fields.';
      }

      throw new BadRequestException({
        message: 'Failed to process guard upload',
        errors: [
          {
            row: rowNumber,
            message: safeMessage,
          },
        ],
      });
    }
  }

  async create(data: CreateGuardDto, organizationId: string) {
    try {
      if (!data.serviceNumber) {
        const lastGuard = await this.prisma.guard.findFirst({
          where: { organizationId },
          orderBy: { serviceNumber: 'desc' },
        });
        data.serviceNumber = lastGuard ? lastGuard.serviceNumber + 1 : 1;
      }

      return await this.prisma.guard.create({
        data: {
          ...data,
          organizationId,
          serviceNumber: data.serviceNumber,
          academic: { create: data.academic },
          drivingLicense: { create: data.drivingLicense },
          guardExperience: { create: data.guardExperience },
          references: data.references
            ? {
                create: data.references.map((ref) => ({
                  fullName: ref.name || '',
                  fatherName: ref.fatherName || '',
                  cnicNumber: ref.cnicNumber || '',
                  contactNumber: ref.contactNumber || '',
                  currentAddress: ref.currentAddress || '',
                  permanentAddress: ref.permanentAddress || '',
                  cnicFront: ref.cnicFront || '',
                  cnicBack: ref.cnicBack || '',
                })),
              }
            : undefined,
          bankAccount: { create: data.bankAccount },
          guardDocuments: { create: data.guardDocuments },
          biometric: data.biometric ? { create: data.biometric } : undefined,
        },
        include: {
          academic: true,
          drivingLicense: true,
          guardExperience: true,
          references: true,
          bankAccount: true,
          guardDocuments: true,
          biometric: true,
        },
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  findAll() {
    return this.prisma.guard.findMany({
      include: {
        academic: true,
        drivingLicense: true,
        guardExperience: true,
        references: true,
        bankAccount: true,
        guardDocuments: true,
        biometric: true,
      },
    });
  }

  async findOne(id: string, organizationId: string, user?: any) {
    // First, get the guard by ID only
    const guard = await this.prisma.guard.findUnique({
      where: { id },
      include: {
        academic: true,
        drivingLicense: true,
        guardExperience: true,
        references: true,
        bankAccount: true,
        guardDocuments: true,
        biometric: true,
      },
    });

    if (!guard) {
      throw new NotFoundException("Guard doesn't exist");
    }

    // Then check organization scope
    if (guard.organizationId !== organizationId) {
      throw new NotFoundException("Guard doesn't exist");
    }

    // Finally check office scope for manager/staff
    const filter = shouldFilterByOffice(user, { allowStaff: true });
    if (filter.shouldFilter && filter.officeId && guard.officeId !== filter.officeId) {
      throw new ForbiddenException('You do not have permission to access this guard');
    }

    // Supervisor location-based restriction: ensure guard is assigned to one of supervisor's locations
    const locationFilter = await getSupervisorLocationFilter(user, this.prisma);
    if (locationFilter.shouldFilter) {
      // If supervisor has no assigned locations, deny access immediately
      if (!locationFilter.locationIds || locationFilter.locationIds.length === 0) {
        throw new ForbiddenException('You do not have permission to access this guard');
      }
      const assigned = await this.prisma.assignedGuard.findFirst({ where: { guardId: guard.id, locationId: { in: locationFilter.locationIds }, deploymentTill: null } });
      if (!assigned) {
        throw new ForbiddenException('You do not have permission to access this guard');
      }
    }

    if (guard.guardDocuments) {
      const documentFields = [
        'picture',
        'cnicFront',
        'cnicBack',
        'licenseFront',
        'licenseBack',
      ];

      const signedDocumentUrls: Record<string, string> = {};

      if (guard.guardDocuments) {
        await Promise.all(
          documentFields.map(async (field) => {
            const docs = guard.guardDocuments;
            signedDocumentUrls['picture'] =
              await this.fileService.getSecureDownloadUrl(docs!.picture);
            signedDocumentUrls['cnicFront'] =
              await this.fileService.getSecureDownloadUrl(docs!.cnicFront);
            signedDocumentUrls['cnicBack'] =
              await this.fileService.getSecureDownloadUrl(docs!.cnicBack);
            docs?.licenseFront != null
              ? (signedDocumentUrls['licenseFront'] =
                  await this.fileService.getSecureDownloadUrl(
                    docs?.licenseFront,
                  ))
              : null;
            docs?.licenseBack != null
              ? (signedDocumentUrls['licenseBack'] =
                  await this.fileService.getSecureDownloadUrl(
                    docs?.licenseBack,
                  ))
              : null;
          }),
        );
      }

      return {
        ...guard,
        documentUrls: signedDocumentUrls,
      };
    } else {
      return guard;
    }
  }

  async getBiometricStatus(id: string, organizationId: string, user?: any) {
    const guard = await this.findOne(id, organizationId, user);
    return buildBiometricStatus(guard.biometric);
  }

  async getBiometricCaptures(id: string, organizationId: string, user?: any) {
    const guard = await this.findOne(id, organizationId, user);
    return buildBiometricCaptures(this.fileService, guard.biometric);
  }

  async findByServiceNumber(serviceNumber: number, organizationId: string, user?: any) {
    try {
      const filter = shouldFilterByOffice(user, { allowStaff: true });
      const where: any = { serviceNumber: serviceNumber, organizationId: organizationId };
      if (filter.shouldFilter && filter.officeId) where.officeId = filter.officeId;

      const locationFilter = await getSupervisorLocationFilter(user, this.prisma);
      if (locationFilter.shouldFilter) {
        // If supervisor has no assigned locations, treat as not found for single-item lookup
        if (!locationFilter.locationIds || locationFilter.locationIds.length === 0) {
          throw new NotFoundException("Guard doesn't exist");
        }
        where.assignedGuard = { some: { locationId: { in: locationFilter.locationIds }, deploymentTill: null } };
      }

      const guard = await this.prisma.guard.findFirst({
        where,
        include: {
          academic: true,
          drivingLicense: true,
          guardExperience: true,
          references: true,
          bankAccount: true,
          guardDocuments: true,
          biometric: true,
        },
      });

      if (!guard) throw new NotFoundException("Guard doesn't exist");

      // if(guard.guardDocuments){
      //     const documentFields = [
      //     'picture',
      //     'cnicFront',
      //     'cnicBack',
      //     'licenseFront',
      //     'licenseBack',
      //   ];

      // const signedDocumentUrls: Record<string, string> = {};

      // if (guard.guardDocuments) {
      //   await Promise.all(
      //     documentFields.map(async (field) => {
      //       const docs = guard.guardDocuments;
      //         signedDocumentUrls["picture"] = await this.fileService.getSecureDownloadUrl(docs!.picture);
      //         signedDocumentUrls["cnicFront"] = await this.fileService.getSecureDownloadUrl(docs!.cnicFront);
      //         signedDocumentUrls["cnicBack"] = await this.fileService.getSecureDownloadUrl(docs!.cnicBack);
      //         docs?.licenseFront != null ? signedDocumentUrls["licenseFront"] = await this.fileService.getSecureDownloadUrl(docs?.licenseFront): null;
      //         docs?.licenseBack != null ? signedDocumentUrls["licenseBack"] = await this.fileService.getSecureDownloadUrl(docs?.licenseBack) : null;
      //     })
      //   );
      // }

      //   return {
      //     ...guard,
      //   };

      // }
      // else{
      return guard;
      // }
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async findGuardsByOrganizationId(organizationId: string, user?: any) {
    const filter = shouldFilterByOffice(user, { allowStaff: true });
    const where: any = {
      organizationId: organizationId,
      isActive: true,
    };
    if (filter.shouldFilter && filter.officeId) where.officeId = filter.officeId;

  const locationFilter = await getSupervisorLocationFilter(user, this.prisma);
  if (locationFilter.shouldFilter) {
    // If supervisor has no assigned locations, return empty result set for collection endpoints
    if (!locationFilter.locationIds || locationFilter.locationIds.length === 0) {
      return [];
    }
    where.assignedGuard = { some: { locationId: { in: locationFilter.locationIds }, deploymentTill: null } };
  }

    return this.prisma.guard.findMany({
      where,
      include: {
        academic: true,
        drivingLicense: true,
        guardExperience: true,
        references: true,
        bankAccount: true,
        guardDocuments: true,
        biometric: true,
        assignedGuard: {
          include: {
            requestedGuard: {
              select: {
                id: true,
                guardCategory: {
                  select: {
                    categoryName: true,
                  },
                },
              },
            },
            location: {
              select: {
                id: true,
                locationName: true,
                createdLocationId: true,
                city: true,
                provinceState: true,
              },
            },
          },
        },
      },
    });
  }

  async findGuardsWithAssignedLocations(organizationId: string, user?: any) {
  const filter = shouldFilterByOffice(user, { allowStaff: true });
  const where: any = { organizationId: organizationId, isActive: true };
  if (filter.shouldFilter && filter.officeId) where.officeId = filter.officeId;

  const locationFilter = await getSupervisorLocationFilter(user, this.prisma);
  if (locationFilter.shouldFilter) {
    // If supervisor has no assigned locations, return empty result set for collection endpoints
    if (!locationFilter.locationIds || locationFilter.locationIds.length === 0) {
      return [];
    }
    where.assignedGuard = { some: { locationId: { in: locationFilter.locationIds }, deploymentTill: null } };
  }

    return this.prisma.guard.findMany({
      where,
      select: {
        id: true,
        organizationId: true,
        officeId: true,
        isActive: true,
        serviceNumber: true,
        registrationDate: true,
        fullName: true,
        fatherName: true,
        dateOfBirth: true,
        cnicNumber: true,
        cnicIssueDate: true,
        cnicExpiryDate: true,
        contactNumber: true,
        currentAddress: true,
        assignedGuard: {
    where: locationFilter && locationFilter.shouldFilter ? { locationId: { in: locationFilter.locationIds }, deploymentTill: null } : { deploymentTill: null },
          select: {
            requestedGuard: {
              select: {
                id: true,
                guardCategory: {
                  select: {
                    categoryName: true,
                  },
                },
                location: {
                  select: {
                    id: true,
                    locationName: true,
                    createdLocationId: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async update(id: string, data: UpdateGuardDto, user?: any) {
    const guard = await this.prisma.guard.findUnique({
      where: { id },
    });

    if (!guard) {
      throw new NotFoundException("guard doesn't exist");
    }

    // Ensure guard belongs to user's organization
    if (guard.organizationId !== user.organizationId) {
      throw new ForbiddenException('You do not have permission to update this guard');
    }

    // Then check office restrictions for manager/staff
    const filter = shouldFilterByOffice(user, { allowStaff: true });
    if (filter.shouldFilter && filter.officeId && guard.officeId !== filter.officeId) {
      throw new ForbiddenException('You do not have permission to update this guard');
    }

    // Destructure nested fields
    const {
      academic,
      drivingLicense,
      guardExperience,
      references,
      bankAccount,
      biometric,
      guardDocuments,
      ...guardData
    } = data;

    // Update Guard main data
    const updatedGuard = await this.prisma.guard.update({
      where: { id },
      data: guardData,
    });

    // Update related data conditionally
    if (academic) {
      await this.prisma.academic.update({
        where: { guardId: id },
        data: academic,
      });
    }

    if (drivingLicense) {
      await this.prisma.drivingLicense.update({
        where: { guardId: id },
        data: drivingLicense,
      });
    }

    if (bankAccount) {
      await this.prisma.bankAccount.update({
        where: { guardId: id },
        data: bankAccount,
      });
    }

    if (biometric) {
      await this.prisma.biometric.update({
        where: { guardId: id },
        data: biometric,
      });
    }

    if (guardExperience && guardExperience.length > 0) {
      await this.prisma.guardExperience.deleteMany({
        where: { guardId: id },
      });

      await this.prisma.guardExperience.createMany({
        data: guardExperience.map((exp) => ({ ...exp, guardId: id })),
      });
    }

    if (references && references.length > 0) {
      await this.prisma.reference.deleteMany({
        where: { guardId: id },
      });

      await this.prisma.reference.createMany({
        data: references.map((ref) => ({
          guardId: id,
          fullName: ref.name || '',
          fatherName: ref.fatherName || '',
          cnicNumber: ref.cnicNumber || '',
          contactNumber: ref.contactNumber || '',
          currentAddress: ref.currentAddress || '',
          permanentAddress: ref.permanentAddress || '',
          cnicFront: ref.cnicFront || '',
          cnicBack: ref.cnicBack || '',
        })),
      });
    }

    return this.prisma.guard.findUnique({
      where: { id },
      include: {
        academic: true,
        drivingLicense: true,
        guardExperience: true,
        references: true,
        bankAccount: true,
        guardDocuments: true,
        biometric: true,
      },
    });
  }

  async remove(id: string) {
    const isExist = await this.prisma.guard.findFirst({ where: { id } });
    if (!isExist) {
      throw new NotFoundException("guard doesn't exist");
    }
    return this.prisma.guard.delete({ where: { id } });
  }

  //#region : ASSIGN GUARD
  async assignGuard(dto: AssignGuardDto, organizationId: string) {
    try {
      // If guardId is provided, use it directly, otherwise lookup by service number
      let guard;
      if (dto.serviceNumber) {
        guard = await this.prisma.guard.findFirst({
          where: {
            serviceNumber: dto.serviceNumber,
            organizationId: organizationId,
          },
        });
        if (!guard)
          throw new NotFoundException(
            `Guard with service number ${dto.serviceNumber} doesn't exist for this organization`,
          );
        dto.guardId = guard.id; // Set the guardId for downstream use
      } else {
        guard = await this.prisma.guard.findUnique({
          where: {
            id: dto.guardId,
            organizationId: organizationId,
          },
        });
        if (!guard)
          throw new NotFoundException(
            "Guard doesn't exist for this organization",
          );
      }

      const location = await this.prisma.location.findUnique({
        where: {
          id: dto.locationId,
          organizationId: organizationId,
        },
      });
      if (!location)
        throw new NotFoundException(
          "Location doesn't exist for this organization",
        );

      const requestedGuard = await this.prisma.requestedGuard.findUnique({
        where: {
          id: dto.requestedGuardId,
          locationId: dto.locationId,
        },
      });
      if (!requestedGuard)
        throw new NotFoundException(
          "Requested Guard doesn't exist for this location",
        );

      // quantity constraint
      if (requestedGuard) {
        const quantity = requestedGuard.quantity;
        const assignedGuard = await this.prisma.assignedGuard.findMany({
          where: { requestedGuardId: dto.requestedGuardId },
        });
        if (assignedGuard.length >= quantity) {
          throw new ForbiddenException(
            'Guards are fully assigned to this requested location, either create new request or update the quantity',
          );
        }
      }

      // location constraint
      const existingAssignedGuard = await this.prisma.assignedGuard.findFirst({
        where: {
          requestedGuardId: dto.requestedGuardId,
        },
      });

      const now = new Date();

      if (existingAssignedGuard) {
        const { deploymentTill } = existingAssignedGuard;

        if (deploymentTill === null) {
          // Case 1: No deployment end date, so we must end it now.
          await this.prisma.assignedGuard.update({
            where: { id: existingAssignedGuard.id },
            data: { deploymentTill: now },
          });
        } else if (
          deploymentTill > now ||
          deploymentTill.getTime() === now.getTime()
        ) {
          // Case 2 & 3: Still deployed (future or exactly now), force end it now.
          await this.prisma.assignedGuard.update({
            where: { id: existingAssignedGuard.id },
            data: { deploymentTill: now },
          });
        }
        // Case 4 (deploymentTill < now): No update needed; already ended.
      }

      const assignGuard = await this.prisma.assignedGuard.create({
        data: {
          guardId: guard.id, // Use resolved guard.id
          locationId: dto.locationId,
          requestedGuardId: dto.requestedGuardId,
          guardCategoryId: dto.guardCategoryId, // Include guard category
          deploymentDate: new Date(),
        },
        include: {
          location: true,
          requestedGuard: {
            include: {
              finances: true,
            },
          },
        },
      });

      return assignGuard;
    } catch (error) {
      handlePrismaError(error);
    }
  }

  /**
   * Get assigned guard details by service number
   */
  async getAssignedGuardByServiceNumber(
    serviceNumber: number,
    organizationId: string,
  ) {
    try {
      // First find the guard by service number
      const guard = await this.prisma.guard.findFirst({
        where: {
          serviceNumber,
          organizationId,
        },
      });

      if (!guard) {
        throw new NotFoundException(
          `Guard with service number ${serviceNumber} not found`,
        );
      }

      // Now get their assignment details
      return this.getAssignedGuardByGuardId(guard.id, organizationId);
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async getAssignedGuardByGuardId(guardId: string, organizationId: string) {
    try {
      if (!organizationId) {
        console.error('[getAssignedGuardByGuardId] Missing organizationId');
        throw new ForbiddenException('Organization ID is required');
      }
      if (!guardId) {
        console.error('[getAssignedGuardByGuardId] Missing guardId');
        throw new ForbiddenException('Guard ID is required');
      }
      const assignedGuard = await this.prisma.assignedGuard.findFirst({
        where: {
          guardId: guardId,
          location: {
            organizationId: organizationId,
          },
        },
        include: {
          location: {
            include: {
              client: {
                select: {
                  id: true,
                  companyName: true,
                  contractNumber: true,
                },
              },
            },
          },
        },
      });

      if (!assignedGuard) {
        throw new NotFoundException(
          'Assigned guard not found for this organization and guard ID',
        );
      }

      let totalWorkingDays: number | null = null;
      if (assignedGuard.deploymentDate) {
        const deploymentDate = new Date(assignedGuard.deploymentDate);
        const deploymentTill = assignedGuard.deploymentTill
          ? new Date(assignedGuard.deploymentTill)
          : new Date();
        const timeDiff = deploymentTill.getTime() - deploymentDate.getTime();
        totalWorkingDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      }

      // Flatten and return relevant info for frontend best practice
      return {
        id: assignedGuard.id,
        guardId: assignedGuard.guardId,
        locationId: assignedGuard.locationId,
        requestedGuardId: assignedGuard.requestedGuardId,
        deploymentDate: assignedGuard.deploymentDate,
        deploymentTill: assignedGuard.deploymentTill,
        guardCategoryId: assignedGuard.guardCategoryId,
        totalWorkingDays,
        clientName: assignedGuard.location?.client?.companyName || null,
        clientContractNumber:
          assignedGuard.location?.client?.contractNumber || null,
        locationName: assignedGuard.location?.locationName || null,
      };
    } catch (error) {
      handlePrismaError(error);
      // Defensive: If handlePrismaError does not throw, throw generic error
      throw new ForbiddenException('Failed to fetch assigned guard');
    }
  }
  //#endregion

  /**
   * Promote an assigned guard to supervisor: assigns 'guardSupervisor' role to guard's user, creates assignment record
   * @param guardId ID of the guard to promote (optional if serviceNumber is provided)
   * @param serviceNumber Service number of the guard to promote (optional if guardId is provided)
   * @param dto DTO containing locationId and clientId for assignment
   * @param organizationId Organization ID for security scope
   */
  async promoteGuardToSupervisor(
    guardId: string | undefined,
    serviceNumber: number | undefined,
    dto: PromoteSupervisorDto,
    organizationId: string,
    personType?: 'guard' | 'employee',
  ) {
    // Find the person (guard or employee) by ID or service number
    let personId: string;
    let personName: string;
    let detectedType: 'guard' | 'employee';

    if (serviceNumber !== undefined) {
      // If personType is specified, only look in that entity
      if (personType === 'guard') {
        const guard = await this.prisma.guard.findFirst({
          where: {
            serviceNumber,
            organizationId,
          },
        });
        if (!guard) {
          throw new NotFoundException(
            `Guard with service number ${serviceNumber} not found in this organization`,
          );
        }
        personId = guard.id;
        personName = guard.fullName;
        detectedType = 'guard';
      } else if (personType === 'employee') {
        const employee = await this.employeeService.findByServiceNumber(
          serviceNumber,
          organizationId,
        );
        if (!employee) {
          throw new NotFoundException(
            `Employee with service number ${serviceNumber} not found in this organization`,
          );
        }
        personId = employee.id;
        personName = employee.fullName;
        detectedType = 'employee';
      } else {
        // No personType specified, try guard first (backward compatible)
        const guard = await this.prisma.guard.findFirst({
          where: {
            serviceNumber,
            organizationId,
          },
        });

        if (guard) {
          personId = guard.id;
          personName = guard.fullName;
          detectedType = 'guard';
        } else {
          // Try finding employee if guard not found
          try {
            const employee = await this.employeeService.findByServiceNumber(
              serviceNumber,
              organizationId,
            );
            if (employee) {
              personId = employee.id;
              personName = employee.fullName;
              detectedType = 'employee';
            } else {
              throw new NotFoundException(
                `No guard or employee found with service number ${serviceNumber} in this organization`,
              );
            }
          } catch (error) {
            throw new NotFoundException(
              `No guard or employee found with service number ${serviceNumber} in this organization`,
            );
          }
        }
      }
    } else if (guardId) {
      const guard = await this.prisma.guard.findUnique({
        where: {
          id: guardId,
          organizationId,
        },
      });
      if (!guard)
        throw new NotFoundException(
          `Guard doesn't exist for this organization`,
        );
      personId = guard.id;
      personName = guard.fullName;
      detectedType = 'guard';
    } else {
      throw new BadRequestException(
        'Either guardId or serviceNumber must be provided',
      );
    }

    // 2. Get the userId linked to this guard/employee (if exists) and assign role
    // Get the userId directly from the resolved person
    let userId: string | undefined;
    if (detectedType === 'guard') {
      const guard = await this.prisma.guard.findUnique({
        where: { id: personId },
        select: { userId: true },
      });
      userId = guard?.userId ?? undefined;
    } else {
      const employee = await this.prisma.employee.findUnique({
        where: { id: personId },
        select: { userId: true },
      });
      userId = employee?.userId ?? undefined;
    }

    if (userId) {
      const supervisorRole = await this.prisma.role.findFirst({
        where: { roleName: RolesEnum.supervisor },
      });

      if (supervisorRole) {
        const existingUserRole = await this.prisma.userRole.findFirst({
          where: {
            userId: userId,
            roleId: supervisorRole.id,
          },
        });

        if (!existingUserRole) {
          await this.prisma.userRole.create({
            data: {
              userId: userId,
              roleId: supervisorRole.id,
            },
          });
        }
      }
    }

    // 3. Create assignment record in assignedSupervisor table
    // Validate required fields in dto
    if (!dto.locationId || !dto.clientId)
      throw new BadRequestException(
        'locationId and clientId are required in body',
      );

    // Check if location and client belong to organization
    const location = await this.prisma.location.findUnique({
      where: {
        id: dto.locationId,
        organizationId,
      },
    });
    if (!location)
      throw new NotFoundException(
        "Location doesn't exist for this organization",
      );

    const client = await this.prisma.client.findUnique({
      where: {
        id: dto.clientId,
        organizationId,
      },
    });
    if (!client)
      throw new NotFoundException("Client doesn't exist for this organization");

    // For guards, resolve or create the employee record
    let employeeIdForAssignment: string;
    if (detectedType === 'guard') {
      const resolvedId = await this.resolveEmployeeIdForGuard(
        personId,
        organizationId,
        true,
      );
      if (!resolvedId) {
        throw new NotFoundException(
          'Failed to resolve employee record for guard',
        );
      }
      employeeIdForAssignment = resolvedId;
    } else {
      employeeIdForAssignment = personId; // For employees, use the ID directly
    }

    // Check if already assigned as supervisor with resolved employee ID
    const existingAssignment = await this.prisma.assignedSupervisor.findFirst({
      where: {
        supervisorEmployeeId: employeeIdForAssignment,
        locationId: dto.locationId,
        clientId: dto.clientId,
        deploymentTill: null,
      },
    });
    if (existingAssignment) {
      return {
        message: 'Already assigned as supervisor for this location and client',
        assignedSupervisor: existingAssignment,
      };
    }

    // Create assignment using resolved employee ID.
    // NOTE: Setting employeeId and supervisorEmployeeId to the same value is intentional.
    // This creates a location-level supervisor posting record rather than a supervisor-supervisee relationship.
    // The same employee ID is used for both fields to indicate this person holds a supervisor position at this location,
    // not that they are supervising themselves. Other employees at this location can then be assigned to this supervisor
    // through separate supervisor assignment records where employeeId != supervisorEmployeeId.
    const assignSupervisor = await this.prisma.assignedSupervisor.create({
      data: {
        locationId: dto.locationId,
        employeeId: employeeIdForAssignment,
        supervisorEmployeeId: employeeIdForAssignment,
        clientId: dto.clientId,
        deploymentDate: new Date(),
      },
      include: {
        location: true,
        client: true,
      },
    });

    return {
      message: 'Successfully promoted to supervisor',
      assignedSupervisor: assignSupervisor,
      person: {
        id: personId,
        serviceNumber:
          detectedType === 'guard'
            ? await this.prisma.guard
                .findUnique({
                  where: { id: personId },
                  select: { serviceNumber: true },
                })
                .then((g) => g?.serviceNumber)
            : await this.prisma.employee
                .findUnique({
                  where: { id: personId },
                  select: { serviceNumber: true },
                })
                .then((e) => e?.serviceNumber),
        fullName: personName,
        type: detectedType,
      },
    };
  }
}
