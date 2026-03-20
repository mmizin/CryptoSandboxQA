import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RegisterWithProfileDto } from './dto/register-with-profile.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { Enable2FaDto } from './dto/enable-2fa.dto';
import { Disable2FaDto } from './dto/disable-2fa.dto';
import { Verify2FaDto } from './dto/verify-2fa.dto';
import { ImpersonateDto } from './dto/impersonate.dto';
import { EndImpersonationDto } from './dto/end-impersonation.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordWithCodeDto } from './dto/reset-password-with-code.dto';
import { TwoFactorService } from './two-factor.service';
import { SessionsService } from './sessions.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SessionGuard } from './session.guard';
import { AdminApiKeyGuard } from './guards/admin-api-key.guard';
import { AdminGuard } from './guards/admin.guard';
import { CurrentUser } from './current-user.decorator';
import { MAX_IMPORT_FILE_BYTES } from './bulk-user-import.parse';

function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim() || null;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private twoFactorService: TwoFactorService,
    private sessionsService: SessionsService,
  ) {}

  @Post('login')
  @ApiOperation({ summary: 'Login' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 201, description: 'Returns access token' })
  @ApiResponse({ status: 201, description: 'Returns tempToken when 2FA required' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request password reset code',
    description:
      'Sends an 8-digit code to the email when the account exists. Response is always the same to avoid email enumeration.',
  })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({ status: 200, description: 'Generic confirmation message' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password with email and code',
    description: 'Consumes the code from the reset email and sets a new password. Invalidates all sessions for the user.',
  })
  @ApiBody({ type: ResetPasswordWithCodeDto })
  @ApiResponse({ status: 200, description: 'Password updated' })
  @ApiResponse({ status: 400, description: 'Invalid or expired code' })
  async resetPassword(@Body() dto: ResetPasswordWithCodeDto) {
    return this.authService.resetPasswordWithCode(dto.email, dto.code, dto.newPassword);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'Returns user and access token' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password, dto.displayName);
  }

  @Post('admin/register')
  @UseGuards(AdminApiKeyGuard)
  @ApiOperation({
    summary: 'Create admin user (protected by ADMIN_API_KEY)',
    description:
      'Creates an admin user. Requires X-Admin-API-Key header (or Authorization: Bearer <key>) matching ADMIN_API_KEY in .env.',
  })
  @ApiHeader({ name: 'X-Admin-API-Key', description: 'Admin API key from ADMIN_API_KEY env' })
  @ApiBody({ type: CreateAdminDto })
  @ApiResponse({ status: 201, description: 'Returns admin user and access token' })
  @ApiResponse({ status: 401, description: 'Invalid or missing admin API key' })
  async createAdmin(@Body() dto: CreateAdminDto) {
    return this.authService.createAdmin(dto.email, dto.password, dto.displayName);
  }

  @Post('admin/create-user')
  @UseGuards(JwtAuthGuard, SessionGuard, AdminGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create user with profile (admin only)',
    description:
      'Persists user and optional profile to the database (same rules as register-with-profile). Does not create a session for the new user.',
  })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: 201, description: 'User created' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 409, description: 'Email or username conflict' })
  async createUserAsAdmin(@Body() dto: CreateUserDto) {
    return this.authService.createUserWithProfileAsAdmin({
      email: dto.email,
      password: dto.password,
      displayName: dto.displayName,
      username: dto.username,
      fullName: dto.fullName,
      photoUrl: dto.photoUrl,
      bio: dto.bio,
      websiteUrl: dto.websiteUrl,
      location: dto.location,
      birthday: dto.birthday,
      languageCode: dto.languageCode,
      timezone: dto.timezone,
      preferences: dto.preferences,
    });
  }

  @Post('admin/bulk-import-users')
  @UseGuards(JwtAuthGuard, SessionGuard, AdminGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMPORT_FILE_BYTES },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CSV or JSON (max 500 rows, 5 MB). Same columns as single create-user.',
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Bulk import users from CSV or JSON (admin only)',
    description:
      'Single multipart upload. Rows are validated like the import template; duplicates in-DB yield skipped; invalid rows yield error entries. Response lists per-row outcomes in file order.',
  })
  @ApiResponse({ status: 201, description: 'created / failed / skipped counts and per-row rows' })
  @ApiResponse({ status: 400, description: 'Missing file or parse error' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  async bulkImportUsers(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('file field is required');
    }
    return this.authService.bulkImportUsersFromFile(file);
  }

  @Post('register-with-profile')
  @ApiOperation({
    summary: 'Register new user with optional profile fields',
    description: 'Creates a user (same as register) plus optional UserProfile fields in one request.',
  })
  @ApiBody({ type: RegisterWithProfileDto })
  @ApiResponse({ status: 201, description: 'Returns user and access token' })
  async registerWithProfile(@Body() dto: RegisterWithProfileDto) {
    return this.authService.registerWithProfile({
      email: dto.email,
      password: dto.password,
      displayName: dto.displayName,
      username: dto.username,
      fullName: dto.fullName,
      photoUrl: dto.photoUrl,
      bio: dto.bio,
      websiteUrl: dto.websiteUrl,
      location: dto.location,
      birthday: dto.birthday,
      languageCode: dto.languageCode,
      timezone: dto.timezone,
      preferences: dto.preferences,
    });
  }

  @Post('impersonate')
  @UseGuards(JwtAuthGuard, SessionGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Impersonate a user (admin only)' })
  @ApiBody({ type: ImpersonateDto })
  @ApiResponse({ status: 201, description: 'Returns target user token and backToAdminToken' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  async impersonate(@CurrentUser() user: { id: string }, @Body() dto: ImpersonateDto) {
    return this.authService.impersonate(user.id, dto.targetUserId);
  }

  @Post('end-impersonation')
  @ApiOperation({ summary: 'End impersonation and return to admin account' })
  @ApiBody({ type: EndImpersonationDto })
  @ApiResponse({ status: 200, description: 'Returns admin token' })
  async endImpersonation(@Body() dto: EndImpersonationDto) {
    return this.authService.endImpersonation(dto.backToAdminToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard, SessionGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout (invalidate session)' })
  @ApiResponse({ status: 200, description: 'Session invalidated' })
  async logout(@Headers('authorization') authHeader?: string) {
    const token = extractBearerToken(authHeader);
    if (token) {
      await this.sessionsService.deleteSessionByToken(token);
    }
    return { success: true };
  }

  @Post('2fa/verify')
  @ApiOperation({ summary: 'Verify 2FA during login' })
  @ApiBody({ type: Verify2FaDto })
  @ApiResponse({ status: 201, description: 'Returns access token after 2FA verification' })
  async verify2Fa(@Body() dto: Verify2FaDto) {
    return this.authService.verify2Fa(dto.tempToken, dto.code);
  }

  @Get('2fa/status')
  @UseGuards(JwtAuthGuard, SessionGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get 2FA status' })
  @ApiResponse({ status: 200, description: 'Returns { enabled: boolean }' })
  async get2FaStatus(@CurrentUser() user: { id: string }) {
    return this.twoFactorService.getStatus(user.id);
  }

  @Get('2fa/setup')
  @UseGuards(JwtAuthGuard, SessionGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get 2FA setup (QR code and secret)' })
  @ApiResponse({ status: 200, description: 'Returns QR code URL and secret' })
  async get2FaSetup(@CurrentUser() user: { id: string }) {
    return this.twoFactorService.getSetup(user.id);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard, SessionGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable 2FA after verifying code' })
  @ApiBody({ type: Enable2FaDto })
  @ApiResponse({ status: 200, description: '2FA enabled, returns backup codes' })
  async enable2Fa(@CurrentUser() user: { id: string }, @Body() dto: Enable2FaDto) {
    return this.twoFactorService.enable(user.id, dto.code);
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard, SessionGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable 2FA' })
  @ApiBody({ type: Disable2FaDto })
  @ApiResponse({ status: 200, description: '2FA disabled' })
  async disable2Fa(@CurrentUser() user: { id: string }, @Body() dto: Disable2FaDto) {
    await this.twoFactorService.disable(user.id, dto.code);
    return { success: true };
  }

  @Get('2fa/backup-codes')
  @UseGuards(JwtAuthGuard, SessionGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get backup codes (throws - use regenerate)' })
  @ApiResponse({ status: 200 })
  async getBackupCodes(@CurrentUser() user: { id: string }) {
    return this.twoFactorService.getBackupCodes(user.id);
  }

  @Post('2fa/backup-codes/regenerate')
  @UseGuards(JwtAuthGuard, SessionGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Regenerate backup codes' })
  @ApiResponse({ status: 200, description: 'Returns new backup codes' })
  async regenerateBackupCodes(@CurrentUser() user: { id: string }) {
    const codes = await this.twoFactorService.regenerateBackupCodes(user.id);
    return { codes };
  }
}
