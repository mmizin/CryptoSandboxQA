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
  ApiTags,
} from '@nestjs/swagger';
import { ApiJsonExample, ApiJsonExamples } from '../openapi/api-json-example.decorator';
import * as OA from '../openapi/response-examples';
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
  @ApiJsonExamples(201, 'Returns access token, or a temporary token when 2FA is required', {
    session: { summary: 'JWT issued', value: OA.auth.accessToken },
    twoFactor: { summary: '2FA verification required', value: OA.auth.requires2FA },
  })
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
  @ApiJsonExample(200, 'Generic confirmation message (same whether or not the email exists)', OA.auth.forgotPassword)
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
  @ApiJsonExample(200, 'Password updated', OA.auth.resetPasswordSuccess)
  @ApiJsonExample(400, 'Invalid or expired code', OA.httpError.badRequest)
  async resetPassword(@Body() dto: ResetPasswordWithCodeDto) {
    return this.authService.resetPasswordWithCode(dto.email, dto.code, dto.newPassword);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register new user' })
  @ApiBody({ type: RegisterDto })
  @ApiJsonExample(201, 'Returns user and access token', OA.auth.accessToken)
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
  @ApiJsonExample(201, 'Returns admin user and access token', OA.auth.adminAccessToken)
  @ApiJsonExample(401, 'Invalid or missing admin API key', OA.httpError.unauthorized)
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
  @ApiJsonExample(201, 'User created (no session for the new user)', OA.users.withProfile)
  @ApiJsonExample(403, 'Admin access required', OA.httpError.forbidden)
  @ApiJsonExample(409, 'Email or username conflict', OA.httpError.conflictEmail)
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
  @ApiJsonExample(201, 'created / failed / skipped counts and per-row outcomes', OA.auth.bulkImport)
  @ApiJsonExample(400, 'Missing file or parse error', OA.httpError.badRequest)
  @ApiJsonExample(403, 'Admin access required', OA.httpError.forbidden)
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
  @ApiJsonExample(201, 'Returns user and access token', OA.auth.accessToken)
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
  @ApiJsonExample(201, 'Returns target user token and backToAdminToken', OA.auth.impersonation)
  @ApiJsonExample(403, 'Admin access required', OA.httpError.forbidden)
  async impersonate(@CurrentUser() user: { id: string }, @Body() dto: ImpersonateDto) {
    return this.authService.impersonate(user.id, dto.targetUserId);
  }

  @Post('end-impersonation')
  @ApiOperation({ summary: 'End impersonation and return to admin account' })
  @ApiBody({ type: EndImpersonationDto })
  @ApiJsonExample(200, 'Returns admin session (access token + user)', OA.auth.adminAccessToken)
  async endImpersonation(@Body() dto: EndImpersonationDto) {
    return this.authService.endImpersonation(dto.backToAdminToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard, SessionGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout (invalidate session)' })
  @ApiJsonExample(200, 'Session invalidated', OA.auth.logout)
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
  @ApiJsonExample(201, 'Returns access token after 2FA verification', OA.auth.accessToken)
  async verify2Fa(@Body() dto: Verify2FaDto) {
    return this.authService.verify2Fa(dto.tempToken, dto.code);
  }

  @Get('2fa/status')
  @UseGuards(JwtAuthGuard, SessionGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get 2FA status' })
  @ApiJsonExample(200, 'Returns { enabled: boolean }', OA.auth.twoFaStatus)
  async get2FaStatus(@CurrentUser() user: { id: string }) {
    return this.twoFactorService.getStatus(user.id);
  }

  @Get('2fa/setup')
  @UseGuards(JwtAuthGuard, SessionGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get 2FA setup (QR code and secret)' })
  @ApiJsonExample(200, 'Returns QR data URL and secret', OA.auth.twoFaSetup)
  async get2FaSetup(@CurrentUser() user: { id: string }) {
    return this.twoFactorService.getSetup(user.id);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard, SessionGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable 2FA after verifying code' })
  @ApiBody({ type: Enable2FaDto })
  @ApiJsonExample(200, '2FA enabled, returns backup codes', OA.auth.twoFaEnable)
  async enable2Fa(@CurrentUser() user: { id: string }, @Body() dto: Enable2FaDto) {
    return this.twoFactorService.enable(user.id, dto.code);
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard, SessionGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable 2FA' })
  @ApiBody({ type: Disable2FaDto })
  @ApiJsonExample(200, '2FA disabled', OA.auth.twoFaDisable)
  async disable2Fa(@CurrentUser() user: { id: string }, @Body() dto: Disable2FaDto) {
    await this.twoFactorService.disable(user.id, dto.code);
    return { success: true };
  }

  @Get('2fa/backup-codes')
  @UseGuards(JwtAuthGuard, SessionGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get backup codes (throws - use regenerate)' })
  @ApiJsonExample(200, 'Original codes are not retrievable after setup', OA.auth.twoFaBackupCodesInfo)
  async getBackupCodes(@CurrentUser() user: { id: string }) {
    return this.twoFactorService.getBackupCodes(user.id);
  }

  @Post('2fa/backup-codes/regenerate')
  @UseGuards(JwtAuthGuard, SessionGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Regenerate backup codes' })
  @ApiJsonExample(200, 'Returns new backup codes', OA.auth.twoFaRegenerate)
  async regenerateBackupCodes(@CurrentUser() user: { id: string }) {
    const codes = await this.twoFactorService.regenerateBackupCodes(user.id);
    return { codes };
  }
}
