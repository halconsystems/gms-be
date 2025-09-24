import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateGuardDto } from './dto/create-guard-dto';
import { UpdateGuardDto } from './dto/update-guard-dto';
import { handlePrismaError } from 'src/common/utils/prisma-error-handler';
import { GetObjectCommand, GetObjectCommandInput } from '@aws-sdk/client-s3/dist-types/commands/GetObjectCommand';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { FileService } from 'src/file/file.service';
import { AssignGuardDto } from './dto/assigned-guard-dto';

@Injectable()
export class GuardService {
  constructor(  private readonly fileService: FileService , private readonly prisma: PrismaService) {}

  async create(data: CreateGuardDto, organizationId: string) {
    try {

      
      if(!data.serviceNumber){
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
          references: data.references ? {
            create: data.references.map(ref => ({
              fullName: ref.name || '',
              fatherName: ref.fatherName || '',
              cnicNumber: ref.cnicNumber || '',
              contactNumber: ref.contactNumber || '',
              currentAddress: ref.currentAddress || '',
              permanentAddress: ref.permanentAddress || '',
              cnicFront: ref.cnicFront || '',
              cnicBack: ref.cnicBack || ''
            }))
          } : undefined,
          bankAccount: { create: data.bankAccount },
          guardDocuments: { create : data.guardDocuments },
          biometric: data.biometric ? { create: data.biometric } : undefined,
        },
        include: {
          academic: true,
          drivingLicense: true,
          guardExperience: true,
          references: true,
          bankAccount: true,
          guardDocuments : true,
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
        guardDocuments : true,
        biometric: true,
      },
    });
  }
  


    async findOne(id: string, organizationId : string) {
      const guard = await this.prisma.guard.findUnique({
        where: { id : id , organizationId : organizationId },
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

      if (!guard) return new NotFoundException("Guard doesn't exist");

      if(guard.guardDocuments){
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
                signedDocumentUrls["picture"] = await this.fileService.getSecureDownloadUrl(docs!.picture);
                signedDocumentUrls["cnicFront"] = await this.fileService.getSecureDownloadUrl(docs!.cnicFront);
                signedDocumentUrls["cnicBack"] = await this.fileService.getSecureDownloadUrl(docs!.cnicBack);
                docs?.licenseFront != null ? signedDocumentUrls["licenseFront"] = await this.fileService.getSecureDownloadUrl(docs?.licenseFront): null;
                docs?.licenseBack != null ? signedDocumentUrls["licenseBack"] = await this.fileService.getSecureDownloadUrl(docs?.licenseBack) : null;
            })
          );
        }

        return {
          ...guard,
          documentUrls: signedDocumentUrls,
        };

      }
      else{
        return guard;
      }
  }



    async findByServiceNumber(serviceNumber: number, organizationId : string) {
      try {
        const guard = await this.prisma.guard.findFirst({
        where: { serviceNumber : serviceNumber , organizationId : organizationId },
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



  findGuardsByOrganizationId(organizationId: string) {
    return this.prisma.guard.findMany({
      where: { 
        organizationId : organizationId,
        isActive : true 
      },
      include: {
        academic: true,
        drivingLicense: true,
        guardExperience: true,
        references: true,
        bankAccount: true,
        guardDocuments : true,
        biometric: true,
        assignedGuard : {
          include : {
            requestedGuard :{
                  select : {
                    id : true,
                    guardCategory : {
                      select : {
                        categoryName : true
                      }
                    }
                  }
                },
            location : {
              select : {
                id : true,
                locationName : true,
                createdLocationId: true,
                city : true,
                provinceState : true,
              },
            }
          }
        }
      },
    });
  }

  findGuardsWithAssignedLocations(organizationId: string) {
    return this.prisma.guard.findMany({
      where: { 
        organizationId : organizationId,
        isActive : true 
      },
      select: {
        id: true,
        organizationId: true,   
        officeId: true,
        isActive : true,  
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
        assignedGuard : {
          select : {
            requestedGuard :{
                  select : {
                    id : true,
                    guardCategory : {
                      select : {
                        categoryName : true
                      }
                    },
                    location : {
                      select : {
                        id : true,
                        locationName : true,
                        createdLocationId: true,
                      },
                    }
                  }
                },
          }
        }
      },
    });
  }
  

  async update(id: string, data: UpdateGuardDto) {

     const guard = await this.prisma.guard.findUnique({
        where: { id }})

    if(!guard){
      throw new NotFoundException("guard doesn't exist");
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
          cnicBack: ref.cnicBack || ''
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
        guardDocuments : true,
        biometric: true,
      },
    });
  }
  

  async remove(id: string) {
    const isExist  = await this.prisma.guard.findFirst({ where: { id } });
    if(!isExist){
      throw new NotFoundException("guard doesn't exist");

    }
    return this.prisma.guard.delete({ where: { id } });
  }

  //#region : ASSIGN GUARD
  async assignGuard(dto : AssignGuardDto, organizationId : string){
    try {
      const guard = await this.prisma.guard.findUnique({where : { id : dto.guardId, organizationId : organizationId }});
      const location = await this.prisma.location.findUnique({where : { id : dto.locationId, organizationId : organizationId }});
      const requestedGuard = await this.prisma.requestedGuard.findUnique({where : { id : dto.requestedGuardId, locationId : dto.locationId }});

      if(!guard) throw new NotFoundException("Guard doesn't exist for this organization");
      if(!location) throw new NotFoundException("Location doesn't exist for this organization");
      if(!requestedGuard) throw new NotFoundException("Requested Guard doesn't exist for this location");

      // quantity constraint
      if(requestedGuard){
        const quantity = requestedGuard.quantity;
        const assignedGuard = await this.prisma.assignedGuard.findMany({ where : { requestedGuardId : dto.requestedGuardId }});
        if (assignedGuard.length >= quantity){
          throw new ForbiddenException("Guards are fully assigned to this requested location, either create new request or update the quantity");
        }
      }

      //location constraint

      const existingAssignedGuard = await this.prisma.assignedGuard.findFirst({
        where: {
          requestedGuardId: dto.requestedGuardId,
        },
        // orderBy: {
        //   createdAt: 'desc', // optional: get the most recent assignment
        // },
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
        } else if (deploymentTill > now || deploymentTill.getTime() === now.getTime()) {
          // Case 2 & 3: Still deployed (future or exactly now), force end it now.
          await this.prisma.assignedGuard.update({
            where: { id: existingAssignedGuard.id },
            data: { deploymentTill: now },
          });
        }
        // Case 4 (deploymentTill < now): No update needed; already ended.
      }  
                

      const assignGuard =  await this.prisma.assignedGuard.create({ 
        data : { 
          ...dto,
          deploymentDate: new Date(), 
        }, 
        include : { 
          location : true, 
          requestedGuard: {
          include: {
              finances: true
            }
          }
          // guardCategory : true,
          // guard : true
        }
      });

      return assignGuard;

    } catch (error) {
      handlePrismaError(error);
    }
  }


  async getAssignedGuardByGuardId(guardId: string, organizationId: string ) {
      try {
          const assignedGuard = await this.prisma.assignedGuard.findFirst({
            where: { 
              guardId: guardId,
              location : {
                organizationId : organizationId
              } 
            },
            include: {
              location: {
                include : {
                  client : {
                    select : {
                      id : true,
                      companyName : true,
                      contractNumber : true,
                    }
                  }
                }
              },
              
            },
          });

          if (!assignedGuard) return null;

          if (assignedGuard.deploymentDate) {
            const deploymentDate = new Date(assignedGuard.deploymentDate);
            const deploymentTill = assignedGuard.deploymentTill
              ? new Date(assignedGuard.deploymentTill)
              : new Date();

            const timeDiff = deploymentTill.getTime() - deploymentDate.getTime();
            const daysWorked = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

            return {
              ...assignedGuard,
              totalWorkingDays: daysWorked,
            };
          }

          return {
            ...assignedGuard,
            totalWorkingDays: null,
          };
        } catch (error) {
          handlePrismaError(error);
        }
    }
  //#endregion 
}


