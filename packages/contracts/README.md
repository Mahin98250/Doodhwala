# @doodhwala/contracts

Platform-neutral TypeScript domain contracts for the Doodhwala website and native apps.

This package intentionally has no runtime dependencies and does not contain database credentials, Supabase clients, or authorization logic. The backend remains authoritative for permissions, price, stock, serviceability, and order state.

The contracts are an initial vocabulary, not a claim that every flow is implemented. Add fields only when they are supported by the verified backend contract. Keep RPC-specific wire shapes in adapters and map them into these domain types.
