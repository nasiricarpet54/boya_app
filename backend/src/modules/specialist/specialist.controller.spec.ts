import { Test, TestingModule } from '@nestjs/testing';
import { SpecialistController } from './specialist.controller';
import { SpecialistService } from './specialist.service';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';
import { CreateSpecialistDto } from './dto/create-specialist.dto';

describe('SpecialistController', () => {
  let controller: SpecialistController;

  const mockSpecialistService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
  };

  const mockUser: AuthenticatedUser = {
    userId: 'u1',
    phoneNumber: '09120000000',
    role: 'salon_owner',
    tenantId: 'tenant-1',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SpecialistController],
      providers: [
        {
          provide: SpecialistService,
          useValue: mockSpecialistService,
        },
      ],
    }).compile();

    controller = module.get<SpecialistController>(SpecialistController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of specialists for the tenant', async () => {
      const mockResult = [{ id: 'spec-1', tenantId: 'tenant-1' }];
      mockSpecialistService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(mockUser);

      expect(mockSpecialistService.findAll).toHaveBeenCalledWith('tenant-1');
      expect(result).toEqual(mockResult);
    });
  });

  describe('create', () => {
    it('should create a specialist for the tenant', async () => {
      const mockDto: CreateSpecialistDto = {
        userId: 'u2',
        bio: 'Expert',
        skills: ['haircut'],
        commissionRate: 40,
      };
      const mockCreated = { id: 'spec-2', tenantId: 'tenant-1', ...mockDto };
      mockSpecialistService.create.mockResolvedValue(mockCreated);

      const result = await controller.create(mockUser, mockDto);

      expect(mockSpecialistService.create).toHaveBeenCalledWith({
        ...mockDto,
        tenantId: 'tenant-1',
      });
      expect(result).toEqual(mockCreated);
    });
  });

  describe('findById', () => {
    it('should return a specialist by id', async () => {
      const mockSpecialist = { id: 'spec-1', tenantId: 'tenant-1' };
      mockSpecialistService.findById.mockResolvedValue(mockSpecialist);

      const result = await controller.findById(mockUser, 'spec-1');

      expect(mockSpecialistService.findById).toHaveBeenCalledWith('tenant-1', 'spec-1');
      expect(result).toEqual(mockSpecialist);
    });
  });
});
