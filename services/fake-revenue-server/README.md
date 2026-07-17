# Fake Revenue Server

Practice mock of Irish Revenue RPN / PSR for NetToGros Cloud mode.

| Environment | How to run | Base URL for payroll app |
|-------------|------------|---------------------------|
| Local | `npm run revenue:start` from repo root | `http://localhost:3001` |
| Production (Netlify Pro) | Deploy site (functions auto) | `https://<your-domain>/api` |

## Local

```bash
# from NetToGros_Qoder root
npm run revenue:start
```

## Shared logic

- `lib/handlers.js` — used by Express **and** Netlify Functions (`netlify/functions/revenue-*.js`)

## PPSN test profiles

| PPSN pattern | Result |
|--------------|--------|
| Ends with `0` | Error `ERR_001` |
| Ends with `5` | High earner COP |
| Ends with `3` | Low earner COP |
| Other | Standard |

## Endpoints

- `POST /rpn` or `POST /api/rpn`
- `POST /psr` or `POST /api/psr`
- `GET /api/status`
