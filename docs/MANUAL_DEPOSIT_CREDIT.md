# BTCBOX manual deposit credit

## Customer flow

1. The customer selects an asset/network and receives the configured deposit address.
2. The customer sends funds to that address using the displayed network.
3. Staff independently verify the incoming transfer in the relevant wallet/explorer.
4. Staff select the customer and asset in Admin → Users & manual credit, enter the exact verified amount and the transaction hash or auditable receipt reference, then confirm the manual credit.
5. The server sends the credit to the atomic PostgreSQL ledger RPC. The request ID and payload hash protect against duplicate submissions and key reuse with different details.

## Required evidence

- A non-empty transaction hash or receipt reference is required for every manual credit.
- Reference length is limited to 160 characters and control characters are rejected.
- A free-form note remains optional; it supplements but does not replace the reference.
- The reference is included in the atomic RPC request and the request hash so a retry cannot silently change the evidence associated with a credit.

## Important operating boundaries

- This is intentionally a staff-verified, manual-credit flow. It does not create a pending customer deposit order and it does not infer incoming transfers from a user-entered amount.
- A configured deposit address is only an address display setting; it does not prove that funds arrived.
- The API remains fail-closed unless the financial PostgreSQL cutover and atomic manual-deposit RPC are enabled.
- Do not use a customer-provided amount alone as evidence. Verify the amount, asset, network, destination and transaction status independently before crediting.
- If the RPC response is uncertain, retry only with the exact same saved request ID and unchanged payload. Check the financial operation log before creating a new credit request.
