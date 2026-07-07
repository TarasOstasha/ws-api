const REQUEST_TIMEOUT_MS = 15_000;

function parseErrorMessage(body) {
  if (!body) return '';

  try {
    const parsed = JSON.parse(body);
    return parsed.message || parsed.error || body;
  } catch {
    return body;
  }
}
export function normalizePrice(price) {
  const num = parseFloat(String(price));
  if (Number.isNaN(num)) {
    throw new Error(`Invalid price value: ${price}`);
  }
  return num.toFixed(2);
}

export async function fetchItemBySku(sku) {
  const baseUrl = process.env.WSD_API_BASE_URL || 'https://api.wsdisplayapi.com';
  const token = process.env.WSD_API_TOKEN;

  if (!token) {
    return { ok: false, status: 0, message: 'WSD_API_TOKEN is not set' };
  }

  const url = `${baseUrl.replace(/\/$/, '')}/items/sku/${encodeURIComponent(sku)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const message = parseErrorMessage(body) || response.statusText;
      const notFound =
        response.status === 404 ||
        /unable to find item matching provided/i.test(message);

      return {
        ok: false,
        status: response.status,
        message,
        notFound,
      };
    }

    const data = await response.json();

    if (!data.price && data.price !== 0) {
      return { ok: false, status: response.status, message: 'Response missing price field' };
    }

    return {
      ok: true,
      data: {
        itemId: String(data.itemId ?? ''),
        sku: data.sku ?? sku,
        displayName: data.displayName ?? '',
        price: normalizePrice(data.price),
        package: data.package ?? '',
        weight: data.weight ?? '',
        turnTime: data.turnTime ?? '',
        available: Boolean(data.available),
      },
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      message: err.name === 'TimeoutError' ? 'Request timed out' : err.message,
    };
  }
}
