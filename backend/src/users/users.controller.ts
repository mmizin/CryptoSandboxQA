import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ApiJsonExample } from '../openapi/api-json-example.decorator';
import * as OA from '../openapi/response-examples';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SessionGuard } from '../auth/session.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AdminPatchUserDto } from './dto/admin-update-user.dto';
import { AdminReplaceUserDto } from './dto/admin-replace-user.dto';
import { BulkExportUsersQueryDto } from './dto/bulk-export-users.query.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, SessionGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'List users (admin only)' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by email or user ID' })
  @ApiJsonExample(200, 'Returns list of users', [OA.users.listItem])
  async list(@Query('search') search?: string) {
    return this.usersService.findAll(search);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user' })
  @ApiJsonExample(200, 'Returns current user with profile', OA.users.withProfile)
  async me(@CurrentUser() user: { id: string }) {
    const found = await this.usersService.findByIdWithProfile(user.id);
    if (!found) return null;
    const { passwordHash: _, ...result } = found;
    return result;
  }

  @Get('bulk/export')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Export users (admin only)',
    description:
      'first100: earliest 100 by createdAt; last100: latest 100; dateRange: up to 500 users with createdAt between from and to (inclusive). JSON or CSV; never includes password hashes.',
  })
  @ApiJsonExample(200, 'JSON array (application/json) or CSV file (text/csv), depending on format', OA.users.bulkExportJson)
  @ApiJsonExample(400, 'Invalid preset or date range', OA.httpError.badRequestGeneric)
  @ApiJsonExample(403, 'Admin access required', OA.httpError.forbidden)
  async bulkExport(@Query() query: BulkExportUsersQueryDto, @Res({ passthrough: true }) res: Response) {
    const out = await this.usersService.exportBulk(query);
    res.setHeader('Content-Type', out.contentType);
    if (out.attachmentFilename) {
      res.setHeader('Content-Disposition', `attachment; filename="${out.attachmentFilename}"`);
    }
    return out.body;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiJsonExample(200, 'Returns user with profile', OA.users.withProfile)
  @ApiJsonExample(404, 'User not found', OA.httpError.notFound)
  async getById(@Param('id') id: string) {
    const found = await this.usersService.findByIdWithProfile(id);
    if (!found) throw new NotFoundException('User not found');
    const { passwordHash: _, ...result } = found;
    return result;
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update profile' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiJsonExample(200, 'Returns updated user', OA.users.withProfile)
  async updateProfile(@CurrentUser() user: { id: string }, @Body() dto: UpdateProfileDto) {
    const updated = await this.usersService.updateProfile(user.id, dto);
    const { passwordHash: _, ...result } = updated;
    return result;
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Update user (admin only, partial)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({ type: AdminPatchUserDto })
  @ApiJsonExample(200, 'Returns updated user', OA.users.withProfile)
  @ApiJsonExample(404, 'User not found', OA.httpError.notFound)
  @ApiJsonExample(409, 'Email already in use', OA.httpError.conflict)
  async patchUser(@Param('id') id: string, @Body() dto: AdminPatchUserDto) {
    const updated = await this.usersService.updateByAdmin(id, dto);
    const { passwordHash: _, ...result } = updated;
    return result;
  }

  @Put(':id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Replace user (admin only, full update)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({ type: AdminReplaceUserDto })
  @ApiJsonExample(200, 'Returns updated user', OA.users.withProfile)
  @ApiJsonExample(404, 'User not found', OA.httpError.notFound)
  @ApiJsonExample(409, 'Email already in use', OA.httpError.conflict)
  async putUser(@Param('id') id: string, @Body() dto: AdminReplaceUserDto) {
    const updated = await this.usersService.replaceByAdmin(id, dto);
    const { passwordHash: _, ...result } = updated;
    return result;
  }
}
