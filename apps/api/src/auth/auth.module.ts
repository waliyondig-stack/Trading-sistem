import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TenantProvisionService } from '../tenant/tenant-provision.service';
import { AuditModule } from '../audit/audit.module';
import { OutboxModule } from '../outbox/outbox.module';

@Module({
  imports: [JwtModule.register({}), AuditModule, OutboxModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TenantProvisionService],
  exports: [PasswordService, TenantProvisionService],
})
export class AuthModule {}
