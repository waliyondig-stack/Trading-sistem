import { Module } from '@nestjs/common';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { MergeService } from './merge.service';

/**
 * Bounded context Customer / CRM dasar.
 * Memiliki tabel: Customer, CustomerIdentity, CustomerAddress,
 * CustomerMergeCandidate, CustomerMergeHistory.
 */
@Module({
  controllers: [CustomerController],
  providers: [CustomerService, MergeService],
  exports: [CustomerService],
})
export class CustomerModule {}
