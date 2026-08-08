# Security Specification: Accounting System

## 1. Data Invariants
- Products can only be created/updated/deleted by administrators (or users with specific staff roles).
- Sales must have a valid customer ID, valid items, and cannot be modified once finalized.
- Customers can be updated by any authenticated user.

## 2. The "Dirty Dozen" Payloads (Examples)
1. Unauthorized User tries to list all sales from another user.
2. User tries to update a sale after it has been finalized.
3. User tries to create a product with an invalid SKU format.
4. User tries to set their own user role as 'admin'.
5. User tries to set negative inventory quantity.
6. User tries to update customer balance with an unauthorized increase.
7. Unauthenticated user tries to read products.
8. Authenticated user tries to read other user's PII in customers collection.
9. User tries to inject HTML into product name.
10. User sends sale with 1MB of items data.
11. Admin tries to delete a sale record (should be denied).
12. User tries to create product with a duplicate existing SKU.

## 3. Test Runner (firestore.rules.test.ts)
[Placeholder: Will implement this after defining the rules.]
