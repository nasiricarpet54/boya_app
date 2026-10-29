import { Test, TestingModule } from '@nestjs/testing';
import { SpecialistController } from './specialist.controller';
import { SpecialistService } from './specialist.service';

describe('SpecialistController', () => {
  let controller: SpecialistController;
  let service: SpecialistService;

  const mockSpecialistService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
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
    service = module.get<SpecialistService>(SpecialistService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of specialists for the tenant', async () => {
      const mockResult = [{ id: 'spec-1', tenantId: 'tenant-1' }];
      mockSpecialistService.findAll.mockResolvedValue(mockResult);

      const user = { userId: 'u1', phoneNumber: '09120000000', role: 'salon_owner', tenantId: 'tenant-1' } as any;
      const result = await (controller as any).findAll(user);

      expect(mockSpecialistService.findAll).toHaveBeenCalledWith('tenant-1');
      expect(result).toEqual(mockResult);
    });
  });

  describe('create', () => {
    it('should create a specialist for the tenant', async () => {
      const mockDto = { userId: 'u2', bio: 'Expert', skills: ['haircut'], commissionRate: 40 };
      const mockCreated = { id: 'spec-2', tenantId: 'tenant-1', ...mockDto };
      mockSpecialistService.create.mockResolvedValue(mockCreated);

      const user = { userId: 'u1', phoneNumber: '09120000000', role: 'salon_owner', tenantId: 'tenant-1' } as any;
      const result = await (controller as any).create(user, mockDto);

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

      const user = { userId: 'u1', phoneNumber: '09120000000', role: 'salon_owner', tenantId: 'tenant-1' } as any;
      const result = await (controller as any).findById(user, 'spec-1');

      expect(mockSpecialistService.findById).toHaveBeenCalledWith('tenant-1', 'spec-1');
      expect(result).toEqual(mockSpecialist);
    });
  });
});
