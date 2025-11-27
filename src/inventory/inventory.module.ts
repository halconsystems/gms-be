import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';

// Import all inventory sub-modules
import { StoresModule } from './stores/stores.module';
import { CategoriesModule } from './categories/categories.module';
import { GroupsModule } from './groups/groups.module';
import { VendorsModule } from './vendors/vendors.module';
import { ItemsModule } from './items/items.module';
import { PurchaseRequestsModule } from './purchase-requests/purchase-requests.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { GrnModule } from './grn/grn.module';
import { InventoryModule as InventoryTrackingModule } from './inventory/inventory.module';
import { StockTransfersModule } from './stock-transfers/stock-transfers.module';
import { InventoryCardsModule } from './inventory-cards/inventory-cards.module';
import { IssuancesModule } from './issuances/issuances.module';
import { ReturnsModule } from './returns/returns.module';
import { StockMovementsModule } from './stock-movements/stock-movements.module';

/**
 * Inventory Management Module
 * 
 * Handles all inventory operations following a 6-phase workflow:
 * 1. Setup Phase: Stores, Categories, Groups, Vendors, Items
 * 2. Purchase Request Phase: Create, submit, and approve purchase requests
 * 3. Purchase Order Phase: Create purchase orders from approved PRs
 * 4. GRN Phase: Receive goods and update inventory stock levels
 * 5. Stock Management: Transfers, Issuances, Returns, and Inventory Tracking
 * 6. Reporting: Generate inventory reports and audit trails
 * 
 * All operations support multi-tenant isolation using organizationId
 */
@Module({
  imports: [
    PrismaModule,
    // Setup modules
    StoresModule,
    CategoriesModule,
    GroupsModule,
    VendorsModule,
    ItemsModule,
    // Workflow modules
    PurchaseRequestsModule,
    PurchaseOrdersModule,
    GrnModule,
    // Inventory management modules
    InventoryTrackingModule,
    StockTransfersModule,
    InventoryCardsModule,
    IssuancesModule,
    ReturnsModule,
    StockMovementsModule,
  ],
  exports: [
    StoresModule,
    CategoriesModule,
    GroupsModule,
    VendorsModule,
    ItemsModule,
    PurchaseRequestsModule,
    PurchaseOrdersModule,
    GrnModule,
    InventoryTrackingModule,
    StockTransfersModule,
    InventoryCardsModule,
    IssuancesModule,
    ReturnsModule,
    StockMovementsModule,
  ],
})
export class InventoryModule {}
