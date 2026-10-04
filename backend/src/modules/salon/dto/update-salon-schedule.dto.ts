import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

/**
 * Body of `PATCH /salon/me/schedule`.
 *
 * The weekly schedule is approval-gated, so the payload is stored verbatim in
 * `tenants.pending_changes.workingHours`; `tenants.working_hours` only changes
 * when an admin approves. The shape is whatever `working-hours.util` already
 * reads, so this DTO only asserts that it is an object.
 */
export class UpdateSalonScheduleDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {
      saturday: { active: true, start: '09:00', end: '21:00' },
      friday: { active: false },
    },
  })
  @IsObject()
  workingHours!: Record<string, unknown>;
}