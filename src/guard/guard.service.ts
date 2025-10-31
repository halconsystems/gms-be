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

        // Check required fields
        const missing = requiredFields.filter((f) => !g[f]);
        if (missing.length > 0) {
          validationErrors.push({
            row: i + 1,
            missing,
            errors: ['Missing required fields'],
          });
          continue;
        }

        // Check for duplicates within CSV
        if (seenCnicNumbers.has(g.cnicNumber)) {
          duplicatesInCsv.add(g.cnicNumber);
          errors.push('Duplicate CNIC number in CSV');
        }
        if (seenServiceNumbers.has(Number(g.serviceNumber))) {
          errors.push('Duplicate service number in CSV');
        }

        seenCnicNumbers.add(g.cnicNumber);
        seenServiceNumbers.add(Number(g.serviceNumber));

        if (errors.length > 0) {
          validationErrors.push({ row: i + 1, missing: [], errors });
          continue;
        }

        guardsToCreate.push({
          id: undefined,
          organizationId,
          officeId,
          registrationDate: g.registrationDate
            ? new Date(g.registrationDate)
            : now,
          fullName: g.fullName,
          fatherName: g.fatherName || '',
          dateOfBirth: g.dateOfBirth ? new Date(g.dateOfBirth) : null,
          cnicNumber: g.cnicNumber,
          cnicIssueDate: new Date(g.cnicIssueDate),
          currentAddress: g.currentAddress || '',
          permanentAddress: g.permanentAddress || '',
          weight: g.weight ? Number(g.weight) : null,
          height: Number(g.height),
          religion: g.religion || '',
          bloodGroup: g.bloodGroup || '',
          bloodPressure: g.bloodPressure || '120/80',
          heartBeat: g.heartBeat || '',
          eyeColor: g.eyeColor || '',
          disability: g.disability || '',
          eobiNumber: g.eobiNumber || '',
          sessiNumber: g.sessiNumber || '',
          kinName: g.kinName || '',
          kinFatherName: g.kinFatherName || '',
          kinCNIC: g.kinCNIC || '',
          serviceNumber: Number(g.serviceNumber),
          cnicExpiryDate: g.cnicExpiryDate ? new Date(g.cnicExpiryDate) : null,
          contactNumber: g.contactNumber || 'N/A',
          currentAreaPoliceContact: g.currentAreaPoliceContact || 'N/A',
          currentAreaPoliceStation: g.currentAreaPoliceStation || 'N/A',
          kinRelation: g.kinRelation || 'N/A',
          permanentAreaPoliceContact: g.permanentAreaPoliceContact || 'N/A',
          permanentAreaPoliceStation: g.permanentAreaPoliceStation || 'N/A',
          religionSect: g.religionSect || 'N/A',
          kinContactNumber: g.kinContactNumber || 'N/A',
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
      const existingGuards = await this.prisma.guard.findMany({
        where: {
          OR: [
            { cnicNumber: { in: Array.from(seenCnicNumbers) } },
            { serviceNumber: { in: Array.from(seenServiceNumbers) } },
          ],
          organizationId,
        },
        select: { cnicNumber: true, serviceNumber: true },
      });

      const existingCnicNumbers = new Set(
        existingGuards.map((g) => g.cnicNumber),
      );
      const existingServiceNumbers = new Set(
        existingGuards.map((g) => g.serviceNumber),
      );

      // Filter out guards that already exist and collect validation errors
      const newGuards = guardsToCreate.filter((g) => {
        const isDuplicate =
          existingCnicNumbers.has(g.cnicNumber) ||
          existingServiceNumbers.has(g.serviceNumber);
        if (isDuplicate) {
          validationErrors.push({
            row: guards.findIndex((row) => row.cnicNumber === g.cnicNumber) + 1,
            missing: [],
            errors: [
              `Guard with CNIC ${g.cnicNumber} or service number ${g.serviceNumber} already exists in the database`,
            ],
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
      if (
        error instanceof BadRequestException &&
        error.getResponse()['errors']
      ) {
        throw error;
      }

      // For other errors, try to determine the row number from the error message if possible
      const rowMatch = error.message.match(/row (\d+)/i);
      const rowNumber = rowMatch ? parseInt(rowMatch[1]) : 1; // Default to row 1 instead of 0

      throw new BadRequestException({
        message: 'Failed to process guard upload',
        errors: [
          {
            row: rowNumber,
            message: error.message,
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
