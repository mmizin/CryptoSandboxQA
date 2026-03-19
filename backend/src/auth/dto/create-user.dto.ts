import { RegisterWithProfileDto } from './register-with-profile.dto';

/** Admin-only create user payload — same fields and validation as registration with profile. */
export class CreateUserDto extends RegisterWithProfileDto {}
