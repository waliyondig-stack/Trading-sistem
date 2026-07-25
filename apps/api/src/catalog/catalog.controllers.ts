import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseArrayPipe,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@flowniaga/domain';
import type { Request } from 'express';
import { CurrentTenant, CurrentUser, RequirePermissions } from '../common/decorators';
import type { RequestUser, TenantContext } from '../common/request-types';
import { CategoryService } from './category.service';
import { ProductService } from './product.service';
import { ChannelService } from './channel.service';
import { ListingService } from './listing.service';
import { CreateCategoryDto, UpdateCategoryDto } from './category.dto';
import {
  CreateProductDto,
  CreateVariantDto,
  ProductListQueryDto,
  UpdateProductDto,
  UpdateVariantDto,
} from './product.dto';
import { CreateChannelDto, UpdateChannelDto } from './channel.dto';
import {
  CreateListingDto,
  ListingListQueryDto,
  ResolveUnmappedDto,
  UpdateListingDto,
} from './listing.dto';

function actor(user: RequestUser, req: Request) {
  return { userId: user.id, correlationId: req.correlationId, ip: req.ip };
}

@ApiTags('catalog-categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CATALOG_CATEGORY_READ)
  @ApiOperation({ summary: 'Daftar kategori (flat)' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  list(
    @CurrentTenant() ctx: TenantContext,
    @Query('includeInactive', new ParseBoolPipe({ optional: true })) includeInactive?: boolean,
  ) {
    return this.categoryService.list(ctx, includeInactive ?? false);
  }

  @Get('tree')
  @RequirePermissions(PERMISSIONS.CATALOG_CATEGORY_READ)
  @ApiOperation({ summary: 'Tree kategori (nested)' })
  tree(@CurrentTenant() ctx: TenantContext) {
    return this.categoryService.tree(ctx);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CATALOG_CATEGORY_READ)
  @ApiOperation({ summary: 'Detail kategori' })
  detail(@CurrentTenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.categoryService.getById(ctx, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CATALOG_CATEGORY_CREATE)
  @ApiOperation({ summary: 'Buat kategori' })
  create(
    @CurrentTenant() ctx: TenantContext,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateCategoryDto,
    @Req() req: Request,
  ) {
    return this.categoryService.create(ctx, actor(user, req), dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CATALOG_CATEGORY_UPDATE)
  @ApiOperation({ summary: 'Ubah kategori' })
  update(
    @CurrentTenant() ctx: TenantContext,
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
    @Req() req: Request,
  ) {
    return this.categoryService.update(ctx, actor(user, req), id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.CATALOG_CATEGORY_DELETE)
  @ApiOperation({ summary: 'Arsipkan kategori (soft delete)' })
  archive(
    @CurrentTenant() ctx: TenantContext,
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.categoryService.archive(ctx, actor(user, req), id);
  }
}

@ApiTags('catalog-products')
@ApiBearerAuth()
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CATALOG_PRODUCT_READ)
  @ApiOperation({ summary: 'Daftar produk (filter, cari, pagination, sorting)' })
  list(@CurrentTenant() ctx: TenantContext, @Query() query: ProductListQueryDto) {
    return this.productService.list(ctx, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CATALOG_PRODUCT_READ)
  @ApiOperation({ summary: 'Detail produk beserta variasi' })
  detail(@CurrentTenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.productService.getById(ctx, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CATALOG_PRODUCT_CREATE)
  @ApiOperation({ summary: 'Buat produk (opsional beserta variasi awal)' })
  create(
    @CurrentTenant() ctx: TenantContext,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateProductDto,
    @Req() req: Request,
  ) {
    return this.productService.create(ctx, actor(user, req), dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CATALOG_PRODUCT_UPDATE)
  @ApiOperation({ summary: 'Ubah produk' })
  update(
    @CurrentTenant() ctx: TenantContext,
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @Req() req: Request,
  ) {
    return this.productService.update(ctx, actor(user, req), id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.CATALOG_PRODUCT_DELETE)
  @ApiOperation({ summary: 'Arsipkan produk (soft delete)' })
  archive(
    @CurrentTenant() ctx: TenantContext,
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.productService.archive(ctx, actor(user, req), id);
  }

  @Post(':id/variants')
  @RequirePermissions(PERMISSIONS.CATALOG_VARIANT_CREATE)
  @ApiOperation({ summary: 'Tambah satu/banyak variasi ke produk' })
  addVariants(
    @CurrentTenant() ctx: TenantContext,
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ParseArrayPipe({ items: CreateVariantDto })) dtos: CreateVariantDto[],
    @Req() req: Request,
  ) {
    return this.productService.addVariants(ctx, actor(user, req), id, dtos);
  }
}

@ApiTags('catalog-variants')
@ApiBearerAuth()
@Controller('variants')
export class VariantController {
  constructor(private readonly productService: ProductService) {}

  @Get('lookup')
  @RequirePermissions(PERMISSIONS.CATALOG_VARIANT_READ)
  @ApiOperation({ summary: 'Cari variasi berdasarkan SKU internal atau barcode' })
  @ApiQuery({ name: 'sku', required: true })
  lookup(@CurrentTenant() ctx: TenantContext, @Query('sku') sku: string) {
    return this.productService.lookupVariant(ctx, sku ?? '');
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CATALOG_VARIANT_UPDATE)
  @ApiOperation({ summary: 'Ubah variasi (harga, status, atribut)' })
  update(
    @CurrentTenant() ctx: TenantContext,
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVariantDto,
    @Req() req: Request,
  ) {
    return this.productService.updateVariant(ctx, actor(user, req), id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.CATALOG_VARIANT_DELETE)
  @ApiOperation({ summary: 'Arsipkan variasi (soft delete)' })
  archive(
    @CurrentTenant() ctx: TenantContext,
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.productService.archiveVariant(ctx, actor(user, req), id);
  }
}

@ApiTags('catalog-channels')
@ApiBearerAuth()
@Controller('channels')
export class ChannelController {
  constructor(private readonly channelService: ChannelService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CATALOG_CHANNEL_LISTING_READ)
  @ApiOperation({ summary: 'Daftar kanal tenant' })
  list(@CurrentTenant() ctx: TenantContext) {
    return this.channelService.list(ctx);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CATALOG_CHANNEL_LISTING_MANAGE)
  @ApiOperation({ summary: 'Buat kanal (manual/pos/csv/mock — tanpa integrasi nyata)' })
  create(
    @CurrentTenant() ctx: TenantContext,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateChannelDto,
    @Req() req: Request,
  ) {
    return this.channelService.create(ctx, actor(user, req), dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CATALOG_CHANNEL_LISTING_MANAGE)
  @ApiOperation({ summary: 'Ubah kanal' })
  update(
    @CurrentTenant() ctx: TenantContext,
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateChannelDto,
    @Req() req: Request,
  ) {
    return this.channelService.update(ctx, actor(user, req), id, dto);
  }
}

@ApiTags('catalog-channel-listings')
@ApiBearerAuth()
@Controller('channel-listings')
export class ListingController {
  constructor(private readonly listingService: ListingService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CATALOG_CHANNEL_LISTING_READ)
  @ApiOperation({ summary: 'Daftar pemetaan listing kanal' })
  list(@CurrentTenant() ctx: TenantContext, @Query() query: ListingListQueryDto) {
    return this.listingService.list(ctx, query);
  }

  @Get('resolve')
  @RequirePermissions(PERMISSIONS.CATALOG_CHANNEL_LISTING_READ)
  @ApiOperation({ summary: 'Cari variasi dari external SKU pada kanal' })
  @ApiQuery({ name: 'channelId', required: true })
  @ApiQuery({ name: 'externalSku', required: true })
  resolve(
    @CurrentTenant() ctx: TenantContext,
    @Query('channelId', ParseUUIDPipe) channelId: string,
    @Query('externalSku') externalSku: string,
  ) {
    return this.listingService.resolve(ctx, channelId, externalSku ?? '');
  }

  @Post('resolve-unmapped')
  @RequirePermissions(PERMISSIONS.CATALOG_CHANNEL_LISTING_READ)
  @ApiOperation({ summary: 'Deteksi external SKU yang belum terpetakan (batch)' })
  resolveUnmapped(@CurrentTenant() ctx: TenantContext, @Body() dto: ResolveUnmappedDto) {
    return this.listingService.resolveUnmapped(ctx, dto);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CATALOG_CHANNEL_LISTING_MANAGE)
  @ApiOperation({ summary: 'Buat pemetaan listing manual' })
  create(
    @CurrentTenant() ctx: TenantContext,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateListingDto,
    @Req() req: Request,
  ) {
    return this.listingService.create(ctx, actor(user, req), dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CATALOG_CHANNEL_LISTING_MANAGE)
  @ApiOperation({ summary: 'Ubah pemetaan listing' })
  update(
    @CurrentTenant() ctx: TenantContext,
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateListingDto,
    @Req() req: Request,
  ) {
    return this.listingService.update(ctx, actor(user, req), id, dto);
  }
}
