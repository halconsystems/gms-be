# 🚀 Developer Quick Start - Inventory Integration

## For Frontend Developers: How to Use the Service Layer

### Installation
```bash
# Services are already created at: src/services/inventory/
# No additional installation needed
```

### Basic Usage Pattern

```javascript
// 1. Import the service you need
import { itemService } from '@/services/inventory';

// 2. Use in component
const [items, setItems] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetchItems();
}, []);

const fetchItems = async () => {
  try {
    setLoading(true);
    const response = await itemService.fetchItems(page, limit);
    setItems(response.data);
  } catch (error) {
    toast.error('Failed to load items');
  } finally {
    setLoading(false);
  }
};

// 3. Handle in component
if (loading) return <Loader />;
if (items.length === 0) return <Empty />;
return <ItemsList items={items} />;
```

---

## Available Services

### 1. **itemService** - Item Management
```javascript
import { itemService } from '@/services/inventory';

// Fetch items (paginated)
const response = await itemService.fetchItems(page, limit, filters);
// Returns: {data: [], total: number, page: number, totalPages: number}

// Get single item
const item = await itemService.fetchItemById(id);

// Create item
const newItem = await itemService.createItem({
  name: 'Item Name',
  barcode: '123456',
  sku: 'SKU-123',
  categoryId: 'cat-1',
  price: 99.99,
  description: 'Description',
  reorderLevel: 10,
  reorderQuantity: 50
});

// Update item
await itemService.updateItem(itemId, updatedData);

// Delete item
await itemService.deleteItem(itemId);

// Upload image
await itemService.uploadItemImage(itemId, file);

// Search items
const results = await itemService.searchItems('searchTerm');

// Get items by category
const items = await itemService.getItemsByCategory(categoryId);

// Get low stock items
const lowStockItems = await itemService.getLowStockItems();
```

### 2. **storeService** - Warehouse Management
```javascript
import { storeService } from '@/services/inventory';

// Fetch all stores
const stores = await storeService.fetchStores();

// Get single store
const store = await storeService.fetchStoreById(storeId);

// Create store
const newStore = await storeService.createStore({
  name: 'Main Store',
  location: 'Warehouse District',
  address: '123 Main St',
  capacity: 1000,
  manager: 'John Doe',
  phone: '555-1234',
  email: 'store@example.com'
});

// Get store inventory
const inventory = await storeService.getStoreInventory(storeId);

// Get store stock movements
const movements = await storeService.getStoreMovements(storeId, {page: 1, limit: 50});
```

### 3. **purchaseRequestService** - PR Workflow
```javascript
import { purchaseRequestService } from '@/services/inventory';

// Create PR
const pr = await purchaseRequestService.createPurchaseRequest({
  storeId: 'store-1',
  requiredDate: '2025-12-31',
  items: [
    { itemId: 'item-1', quantity: 10, unitPrice: 50 }
  ],
  notes: 'Urgent'
});

// Submit for approval
await purchaseRequestService.submitPurchaseRequest(prId);

// Approve
await purchaseRequestService.approvePurchaseRequest(prId);

// Reject
await purchaseRequestService.rejectPurchaseRequest(prId, {reason: 'Budget limit'});
```

### 4. **purchaseOrderService** - PO Workflow
```javascript
import { purchaseOrderService } from '@/services/inventory';

// Create PO
const po = await purchaseOrderService.createPurchaseOrder({
  vendorId: 'vendor-1',
  storeId: 'store-1',
  prId: 'pr-123', // optional
  items: [{itemId: 'item-1', quantityOrdered: 100, unitPrice: 50}],
  expectedDeliveryDate: '2025-12-31',
  notes: 'Delivery to warehouse'
});

// Workflow transitions
await purchaseOrderService.submitPurchaseOrder(poId);
await purchaseOrderService.confirmPurchaseOrder(poId);
await purchaseOrderService.approvePurchaseOrder(poId);
```

### 5. **grnService** - Goods Receipt (CRITICAL 7-Step Transaction)
```javascript
import { grnService } from '@/services/inventory';

// Create GRN (starts as PENDING)
const grn = await grnService.createGrn({
  poId: 'po-123',
  storeId: 'store-1',
  vendorId: 'vendor-1',
  receivedDate: new Date(),
  items: [
    {
      poItemId: 'poi-123',
      itemId: 'item-1',
      quantityReceived: 100,
      conditionStatus: 'NEW'
    }
  ]
});

// Start inspection
await grnService.startInspection(grnId);

// CRITICAL: Receive GRN (7-step atomic transaction)
// This single call does:
// 1. Verify items match PO
// 2. Quality inspection
// 3. Accept/reject quantities
// 4. Update PO line items
// 5. Update inventory stock
// 6. Record stock movements
// 7. Update PO status
const received = await grnService.receiveGrn(grnId, {
  items: [
    {
      itemId: 'item-1',
      quantityAccepted: 95,
      quantityRejected: 5,
      conditionStatus: 'GOOD'
    }
  ]
});

// Note: This transaction auto-updates:
// - Inventory (quantityOnHand += accepted)
// - PO (status changes based on fulfillment)
// - Stock movements (audit trail)
// - GRN status (RECEIVED)
```

### 6. **inventoryService** - Stock Management
```javascript
import { inventoryService } from '@/services/inventory';

// Fetch store inventory
const inventory = await inventoryService.fetchStoreInventory(storeId);

// Get item inventory
const itemInv = await inventoryService.fetchItemInventory(itemId);

// Get available stock
const available = await inventoryService.getAvailableStock(itemId, storeId);

// Get alerts
const lowStock = await inventoryService.getLowStockItems();
const overStock = await inventoryService.getOverstockItems();

// Get summary
const summary = await inventoryService.getInventorySummary();
// Returns: {totalItems, totalQuantity, totalValue, lowStockCount}

// Cycle count
await inventoryService.updateInventoryCount(storeId, {
  items: [
    { itemId: 'item-1', countedQuantity: 45, adjustmentNotes: 'Found 3 missing' }
  ]
});

// Search inventory
const results = await inventoryService.searchInventory('search term', storeId);
```

### 7. **stockTransferService** - Inter-Store Transfers
```javascript
import { stockTransferService } from '@/services/inventory';

// Create transfer
const transfer = await stockTransferService.createStockTransfer({
  fromStoreId: 'store-1',
  toStoreId: 'store-2',
  items: [
    { itemId: 'item-1', quantityTransferred: 50 }
  ],
  notes: 'Rebalancing inventory'
});

// Workflow
await stockTransferService.initiateTransfer(transferId);
await stockTransferService.receiveTransfer(transferId, {
  items: [
    { itemId: 'item-1', quantityReceived: 50 }
  ]
});

// Or cancel
await stockTransferService.cancelTransfer(transferId, {reason: 'Changed mind'});
```

### 8. **issuanceService** - Equipment to Guards
```javascript
import { issuanceService } from '@/services/inventory';

// Create issuance
const issue = await issuanceService.createIssuance({
  guardId: 'guard-123',
  storeId: 'store-1',
  items: [
    { itemId: 'item-1', quantity: 2, serialNumber: 'ABC123' }
  ]
});

// Query
const guarded = await issuanceService.getGuardIssuances(guardId);
const active = await issuanceService.getActiveIssuancesForGuard(guardId);
```

### 9. **returnService** - Returns Processing
```javascript
import { returnService } from '@/services/inventory';

// Create return
const ret = await returnService.createReturn({
  issuanceId: 'issue-123',
  guardId: 'guard-123',
  storeId: 'store-1',
  items: [
    { itemId: 'item-1', quantityReturned: 1, condition: 'GOOD' }
  ]
});

// Query
const returns = await returnService.getGuardReturns(guardId);
const summary = await returnService.getGuardReturnSummary(guardId);
```

### 10. **categoryService** - Item Categories
```javascript
import { categoryService } from '@/services/inventory';

// CRUD
const categories = await categoryService.fetchCategories();
await categoryService.createCategory({name: 'New', description: 'New items'});
await categoryService.updateCategory(catId, {name: 'Used'});
await categoryService.deleteCategory(catId);
```

---

## Error Handling Pattern

```javascript
// All services throw errors that you should catch
try {
  await itemService.createItem(formData);
  toast.success('Item created');
} catch (error) {
  // Error messages from API
  if (error.response?.status === 409) {
    toast.error('SKU already exists');
  } else if (error.response?.status === 400) {
    toast.error(error.response.data?.message);
  } else {
    toast.error('Failed to create item');
  }
}
```

---

## Loading State Pattern

```javascript
const [loading, setLoading] = useState(false);

const handleSave = async () => {
  setLoading(true);
  try {
    await itemService.createItem(data);
    toast.success('Saved');
  } catch (error) {
    toast.error('Failed');
  } finally {
    setLoading(false);
  }
};

// In JSX
<button disabled={loading}>
  {loading && <Spinner />}
  Save
</button>
```

---

## Common Patterns in ItemsPage (Reference)

### Pagination
```javascript
const [currentPage, setCurrentPage] = useState(1);
const [itemsPerPage, setItemsPerPage] = useState(10);

const fetchItems = async () => {
  const response = await itemService.fetchItems(currentPage, itemsPerPage);
  setItems(response.data);
  setTotalPages(response.totalPages);
};

useEffect(() => {
  fetchItems();
}, [currentPage, itemsPerPage]);
```

### Search (Client-side Filter)
```javascript
const [searchTerm, setSearchTerm] = useState('');

const displayItems = items.filter(item =>
  item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
  item.sku?.toLowerCase().includes(searchTerm.toLowerCase())
);

// Or server-side search
const handleSearch = async (term) => {
  const results = await itemService.searchItems(term);
  setItems(results);
};
```

### Form Modal
```javascript
const [showModal, setShowModal] = useState(false);
const [formData, setFormData] = useState({...initialState});

const handleChange = (e) => {
  setFormData(prev => ({...prev, [e.target.name]: e.target.value}));
};

const handleSubmit = async () => {
  await itemService.createItem(formData);
  setShowModal(false);
  fetchItems();
};
```

---

## API Response Format

All services return responses like:

```javascript
// List responses
{
  data: [{id, name, ...}, ...],
  total: 100,
  page: 1,
  totalPages: 10
}

// Single item responses
{
  id: 'uuid',
  name: 'Item Name',
  ...allFields
}

// Error responses (caught by services)
{
  status: 400,
  message: 'Validation failed',
  errors: {...}
}
```

---

## NextSteps for Components

### Follow ItemsPage Pattern for:
1. **PurchaseRequestPage** - Use purchaseRequestService
2. **PurchaseOrderPage** - Use purchaseOrderService
3. **ReceiveGRNPage** - Use grnService (test 7-step transaction)
4. **SetupLayoutPage** - Use storeService, categoryService
5. **OverviewPage** - Use inventoryService for dashboard data

### Template
```javascript
// 1. Import service
import { specificService } from '@/services/inventory';

// 2. Set up state
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);

// 3. Fetch on mount
useEffect(() => { fetchData(); }, []);

// 4. API call
const fetchData = async () => {
  try {
    setLoading(true);
    const response = await specificService.fetchData();
    setData(response.data);
  } catch (error) {
    toast.error('Failed to load data');
  } finally {
    setLoading(false);
  }
};

// 5. Render
if (loading) return <Loader />;
return <DataDisplay data={data} />;
```

---

**Status**: All services ready. ItemsPage complete. Next: PurchaseRequestPage
