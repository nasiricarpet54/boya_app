import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { UploadedImageFile } from './upload.service';
import { UploadService } from './upload.service';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

/**
 * Image upload for the salon panel (cover photo, specialist avatar, portfolio).
 *
 * Files are held in memory and written by the service, which is what makes the
 * MIME/size checks authoritative — multer's own limits would answer with an
 * English message, while the service throws the Persian ones the app displays.
 */
@ApiTags('upload')
@ApiBearerAuth()
@Controller('upload')
export class UploadController {
  constructor(private readonly service: UploadService) {}

  @Post('image')
  @Roles('salon_owner', 'line_manager', 'admin')
  @ApiOperation({ summary: 'آپلود تصویر' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  async uploadImage(
    @UploadedFile() file: UploadedImageFile | undefined,
    @Body('category') category: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ url: string }> {
    // The tenant directory comes from the verified token; an admin has none, so
    // their uploads land under a shared `admin` prefix rather than being refused.
    const tenantId = user.tenantId ?? 'admin';
    const url = await this.service.saveImage(file, tenantId, category || 'general');
    return { url };
  }

  @Delete('image')
  @Roles('salon_owner', 'line_manager', 'admin')
  @ApiOperation({ summary: 'حذف تصویر' })
  async deleteImage(@Body('url') url: string): Promise<{ success: boolean }> {
    await this.service.deleteImage(url ?? '');
    return { success: true };
  }
}
