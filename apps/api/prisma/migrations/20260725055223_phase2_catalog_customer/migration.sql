-- CreateEnum
CREATE TYPE "CatalogStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('PHYSICAL', 'SERVICE', 'DIGITAL', 'BUNDLE');

-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('MANUAL', 'POS', 'CSV', 'MOCK_MARKETPLACE', 'WEBSITE', 'WHATSAPP_PLACEHOLDER');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING', 'SYNCED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('PREVIEWED', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MERGED');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('UNKNOWN', 'OPTED_IN', 'OPTED_OUT');

-- CreateEnum
CREATE TYPE "IdentityType" AS ENUM ('PHONE', 'EMAIL', 'MARKETPLACE_ACCOUNT', 'WHATSAPP', 'MANUAL_REFERENCE');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "MergeCandidateStatus" AS ENUM ('PENDING', 'CONFIRMED_DUPLICATE', 'REJECTED', 'IGNORED');

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "parentCategoryId" UUID,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "categoryId" UUID,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "productType" "ProductType" NOT NULL DEFAULT 'PHYSICAL',
    "brand" TEXT,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "taxCategory" TEXT,
    "defaultUnit" TEXT NOT NULL DEFAULT 'pcs',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "internalSku" TEXT NOT NULL,
    "barcode" TEXT,
    "attributes" JSONB,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "costAmount" BIGINT NOT NULL DEFAULT 0,
    "sellingPrice" BIGINT NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "weightGrams" INTEGER,
    "dimensions" JSONB,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "type" "ChannelType" NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "configuration" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelListing" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "channelId" UUID NOT NULL,
    "productVariantId" UUID NOT NULL,
    "externalProductId" TEXT,
    "externalVariantId" TEXT,
    "externalSku" TEXT NOT NULL,
    "listingName" TEXT NOT NULL,
    "listingStatus" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "channelPrice" BIGINT,
    "synchronizationStatus" "SyncStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "lastSyncedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogImportJob" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PREVIEWED',
    "columnMapping" JSONB,
    "rawContent" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "createdRows" INTEGER NOT NULL DEFAULT 0,
    "updatedRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "rowErrors" JSONB,
    "previewResult" JSONB,
    "idempotencyKey" TEXT,
    "errorMessage" TEXT,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "CatalogImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "type" "CustomerType" NOT NULL DEFAULT 'INDIVIDUAL',
    "displayName" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "companyName" TEXT,
    "primaryPhone" TEXT,
    "primaryEmail" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "consentStatus" "ConsentStatus" NOT NULL DEFAULT 'UNKNOWN',
    "preferredLanguage" TEXT NOT NULL DEFAULT 'id',
    "preferredChannel" TEXT,
    "mergedIntoId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerIdentity" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "identityType" "IdentityType" NOT NULL,
    "channelId" UUID,
    "externalId" TEXT,
    "normalizedValue" TEXT NOT NULL,
    "displayValue" TEXT NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAddress" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Utama',
    "recipientName" TEXT NOT NULL,
    "phone" TEXT,
    "addressLine" TEXT NOT NULL,
    "village" TEXT,
    "district" TEXT,
    "city" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'ID',
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerMergeCandidate" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "customerAId" UUID NOT NULL,
    "customerBId" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "reasons" JSONB NOT NULL,
    "status" "MergeCandidateStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerMergeCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerMergeHistory" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "sourceCustomerId" UUID NOT NULL,
    "targetCustomerId" UUID NOT NULL,
    "snapshotBefore" JSONB NOT NULL,
    "mergeStrategy" JSONB NOT NULL,
    "performedBy" UUID NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,

    CONSTRAINT "CustomerMergeHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Category_tenantId_idx" ON "Category"("tenantId");

-- CreateIndex
CREATE INDEX "Category_tenantId_parentCategoryId_idx" ON "Category"("tenantId", "parentCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_tenantId_parentCategoryId_slug_key" ON "Category"("tenantId", "parentCategoryId", "slug");

-- CreateIndex
CREATE INDEX "Product_tenantId_idx" ON "Product"("tenantId");

-- CreateIndex
CREATE INDEX "Product_tenantId_categoryId_idx" ON "Product"("tenantId", "categoryId");

-- CreateIndex
CREATE INDEX "Product_tenantId_status_idx" ON "Product"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Product_tenantId_name_idx" ON "Product"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_tenantId_slug_key" ON "Product"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "ProductVariant_tenantId_idx" ON "ProductVariant"("tenantId");

-- CreateIndex
CREATE INDEX "ProductVariant_tenantId_productId_idx" ON "ProductVariant"("tenantId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_tenantId_internalSku_key" ON "ProductVariant"("tenantId", "internalSku");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_tenantId_barcode_key" ON "ProductVariant"("tenantId", "barcode");

-- CreateIndex
CREATE INDEX "Channel_tenantId_idx" ON "Channel"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_tenantId_name_key" ON "Channel"("tenantId", "name");

-- CreateIndex
CREATE INDEX "ChannelListing_tenantId_idx" ON "ChannelListing"("tenantId");

-- CreateIndex
CREATE INDEX "ChannelListing_tenantId_productVariantId_idx" ON "ChannelListing"("tenantId", "productVariantId");

-- CreateIndex
CREATE INDEX "ChannelListing_tenantId_externalSku_idx" ON "ChannelListing"("tenantId", "externalSku");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelListing_tenantId_channelId_externalSku_key" ON "ChannelListing"("tenantId", "channelId", "externalSku");

-- CreateIndex
CREATE INDEX "CatalogImportJob_tenantId_createdAt_idx" ON "CatalogImportJob"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogImportJob_tenantId_idempotencyKey_key" ON "CatalogImportJob"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Customer_tenantId_idx" ON "Customer"("tenantId");

-- CreateIndex
CREATE INDEX "Customer_tenantId_displayName_idx" ON "Customer"("tenantId", "displayName");

-- CreateIndex
CREATE INDEX "Customer_tenantId_primaryPhone_idx" ON "Customer"("tenantId", "primaryPhone");

-- CreateIndex
CREATE INDEX "Customer_tenantId_primaryEmail_idx" ON "Customer"("tenantId", "primaryEmail");

-- CreateIndex
CREATE INDEX "Customer_tenantId_status_idx" ON "Customer"("tenantId", "status");

-- CreateIndex
CREATE INDEX "CustomerIdentity_tenantId_identityType_normalizedValue_idx" ON "CustomerIdentity"("tenantId", "identityType", "normalizedValue");

-- CreateIndex
CREATE INDEX "CustomerIdentity_tenantId_customerId_idx" ON "CustomerIdentity"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "CustomerAddress_tenantId_customerId_idx" ON "CustomerAddress"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "CustomerMergeCandidate_tenantId_status_idx" ON "CustomerMergeCandidate"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerMergeCandidate_tenantId_customerAId_customerBId_key" ON "CustomerMergeCandidate"("tenantId", "customerAId", "customerBId");

-- CreateIndex
CREATE INDEX "CustomerMergeHistory_tenantId_performedAt_idx" ON "CustomerMergeHistory"("tenantId", "performedAt");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelListing" ADD CONSTRAINT "ChannelListing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelListing" ADD CONSTRAINT "ChannelListing_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelListing" ADD CONSTRAINT "ChannelListing_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogImportJob" ADD CONSTRAINT "CatalogImportJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerIdentity" ADD CONSTRAINT "CustomerIdentity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerIdentity" ADD CONSTRAINT "CustomerIdentity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerIdentity" ADD CONSTRAINT "CustomerIdentity_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerMergeCandidate" ADD CONSTRAINT "CustomerMergeCandidate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerMergeCandidate" ADD CONSTRAINT "CustomerMergeCandidate_customerAId_fkey" FOREIGN KEY ("customerAId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerMergeCandidate" ADD CONSTRAINT "CustomerMergeCandidate_customerBId_fkey" FOREIGN KEY ("customerBId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerMergeHistory" ADD CONSTRAINT "CustomerMergeHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerMergeHistory" ADD CONSTRAINT "CustomerMergeHistory_sourceCustomerId_fkey" FOREIGN KEY ("sourceCustomerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerMergeHistory" ADD CONSTRAINT "CustomerMergeHistory_targetCustomerId_fkey" FOREIGN KEY ("targetCustomerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
