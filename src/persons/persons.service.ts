import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PersonType } from '../common/enums/person-type.enum';

// Maximum total results to return
const MAX_RESULTS = 20;

@Injectable()
export class PersonsService {
  constructor(private readonly prisma: PrismaService) {}

  async searchPersons(search: string, organizationId: string) {
    try {
      console.log('Search parameters:', { search, organizationId });

      const searchTerm = search?.trim() || '';

      // Return empty result for empty searches
      if (!searchTerm) {
        console.log('Empty search term, returning empty results');
        return [];
      }

      const numericValue = Number(searchTerm);
      const isNumeric = !isNaN(numericValue);

      console.log('Search configuration:', {
        searchTerm,
        numericValue,
        isNumeric,
        organizationId,
      });

      // Get full result sets up to MAX_RESULTS from each type
      console.log('Executing database queries...');
      const [employees, guards] = await Promise.all([
        this.prisma.employee.findMany({
          where: {
            AND: [
              { organizationId },
              { isActive: true },
              { userId: null },
              {
                OR: [
                  ...(isNumeric ? [{ serviceNumber: numericValue }] : []),
                  { fullName: { contains: searchTerm, mode: 'insensitive' } },
                ],
              },
            ],
          },
          select: {
            id: true,
            serviceNumber: true,
            fullName: true,
            organizationId: true,
            userId: true,
          },
          orderBy: isNumeric ? { serviceNumber: 'asc' } : { fullName: 'asc' },
          take: MAX_RESULTS,
        }),
        this.prisma.guard.findMany({
          where: {
            AND: [
              { organizationId },
              { isActive: true },
              { userId: null },
              {
                OR: [
                  ...(isNumeric ? [{ serviceNumber: numericValue }] : []),
                  { fullName: { contains: searchTerm, mode: 'insensitive' } },
                ],
              },
            ],
          },
          select: {
            id: true,
            serviceNumber: true,
            fullName: true,
            organizationId: true,
            userId: true,
          },
          orderBy: isNumeric ? { serviceNumber: 'asc' } : { fullName: 'asc' },
          take: MAX_RESULTS,
        }),
      ]);

      console.log('Query results:', {
        employeesFound: employees.length,
        guardsFound: guards.length,
        employeeSample: employees.slice(0, 1),
        guardsSample: guards.slice(0, 1),
      });

      // Format results without rank property in the output
      const formattedResults = [
        ...employees.map((emp) => ({
          id: emp.id,
          serviceNumber: emp.serviceNumber,
          fullName: emp.fullName,
          personType: PersonType.EMPLOYEE,
        })),
        ...guards.map((guard) => ({
          id: guard.id,
          serviceNumber: guard.serviceNumber,
          fullName: guard.fullName,
          personType: PersonType.GUARD,
        })),
      ];

      // Sort based on search type and relevance
      formattedResults.sort((a, b) => {
        if (isNumeric) {
          // For numeric searches: exact matches first, then service number
          const aIsExact = a.serviceNumber === numericValue;
          const bIsExact = b.serviceNumber === numericValue;
          if (aIsExact !== bIsExact) return aIsExact ? -1 : 1;
          return a.serviceNumber - b.serviceNumber;
        } else {
          // For name searches: sort by name (with null protection), then service number
          const aName = a.fullName || '';
          const bName = b.fullName || '';
          const nameCompare = aName.localeCompare(bName);
          if (nameCompare !== 0) return nameCompare;
          return a.serviceNumber - b.serviceNumber;
        }
      });

      // Get final results
      const finalResults = formattedResults.slice(0, MAX_RESULTS);

      console.log('Final results:', {
        totalResults: finalResults.length,
        firstResult: finalResults[0],
        searchCriteria: {
          searchTerm,
          organizationId,
          isNumeric,
        },
      });

      return finalResults;
    } catch (error) {
      console.error('Error searching persons:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        code: error.code,
        meta: error.meta,
      });
      throw new InternalServerErrorException(
        `Failed to search persons: ${error.message}`,
        { cause: error },
      );
    }
  }
}
