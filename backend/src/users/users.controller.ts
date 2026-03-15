import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  async me(@CurrentUser() user: { id: string }) {
    const found = await this.usersService.findById(user.id);
    if (!found) return null;
    const { passwordHash: _, ...result } = found;
    return result;
  }

  @Patch('me')
  async updateProfile(@CurrentUser() user: { id: string }, @Body() dto: UpdateProfileDto) {
    const updated = await this.usersService.update(user.id, { displayName: dto.displayName });
    const { passwordHash: _, ...result } = updated;
    return result;
  }
}
