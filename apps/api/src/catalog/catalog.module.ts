import { Module } from '@nestjs/common';
import { CategoryService } from './category.service';
import { ProductService } from './product.service';
import { ChannelService } from './channel.service';
import { ListingService } from './listing.service';
import { ImportService } from './import.service';
import {
  CategoryController,
  ChannelController,
  ListingController,
  ProductController,
  VariantController,
} from './catalog.controllers';
import { ImportController } from './import.controller';

/**
 * Bounded context Catalog / PIM.
 * Memiliki tabel: Category, Product, ProductVariant, Channel, ChannelListing,
 * CatalogImportJob. Modul lain tidak menulis tabel ini secara langsung.
 */
@Module({
  controllers: [
    CategoryController,
    ProductController,
    VariantController,
    ChannelController,
    ListingController,
    ImportController,
  ],
  providers: [CategoryService, ProductService, ChannelService, ListingService, ImportService],
  exports: [ProductService],
})
export class CatalogModule {}
