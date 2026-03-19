import { Body, Controller, Get, NotFoundException, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SessionGuard } from '../auth/session.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

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
  @ApiResponse({ status: 200, description: 'Returns list of users' })
  async list(@Query('search') search?: string) {
    return this.usersService.findAll(search);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user' })
  @ApiResponse({ status: 200, description: 'Returns current user with profile' })
  async me(@CurrentUser() user: { id: string }) {
    const found = await this.usersService.findByIdWithProfile(user.id);
    if (!found) return null;
    const { passwordHash: _, ...result } = found;
    return result;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Returns user with profile' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getById(@Param('id') id: string) {
    const found = await this.usersService.findByIdWithProfile(id);
    if (!found) throw new NotFoundException('User not found');
    const { passwordHash: _, ...result } = found;
    return result;
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update profile' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({ status: 200, description: 'Returns updated user' })
  async updateProfile(@CurrentUser() user: { id: string }, @Body() dto: UpdateProfileDto) {
    const updated = await this.usersService.update(user.id, { displayName: dto.displayName });
    const { passwordHash: _, ...result } = updated;
    return result;
  }
}
