import { IsArray, IsBoolean, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/** One assignment row the salon owner sends to `PUT /salon/me/specialists/:id/services`. */
export class SpecialistServiceItemDto {
  @IsUUID('all')
  serviceId!: string;

  /** Absent means "leave as is"; the owner can deactivate a service without un-assigning it. */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * Body of `PUT /salon/me/specialists/:id/services`.
 *
 * The list is *replacing*, not merging: the services missing from it are
 * un-assigned, the ones present are upserted. A checkbox list in the panel maps
 * onto this one-to-one, so there is no second command for removals.
 */
export class SetSpecialistServicesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpecialistServiceItemDto)
  services!: SpecialistServiceItemDto[];
}
