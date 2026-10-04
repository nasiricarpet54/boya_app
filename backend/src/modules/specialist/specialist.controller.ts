import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('specialists')
@Controller('specialists')
export class SpecialistController {}
